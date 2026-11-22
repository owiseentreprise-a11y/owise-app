'use client'

/**
 * Le réglage de la grille v2 et son effet, en direct, sur les courses passées.
 *
 * Les prix sont recalculés dans le navigateur par `prixV2` (fonction pure de
 * src/lib/tarification-v2/grille.ts) à partir des distances déjà mesurées
 * (table v2_mesures_courses) : aucun appel à Google, et l'effet d'un réglage
 * se voit AVANT de l'enregistrer.
 */
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { prixV2, type CleVehiculeV2, type GrilleV2, type MesuresTrajet } from '@/lib/tarification-v2/grille'
import { VEHICULES_V2, NOM_VEHICULE_V2, type TarificationEnService } from '@/lib/tarification-v2/grille-db'
import { formaterMontant } from '@/lib/montant'
import { lieuCourt } from '@/lib/tarification-v2/lieu-court'
import { enregistrerGrilleV2 } from './actions'
import Simulations, { type TrajetType } from './Simulations'

export type CoursePassee = {
  id: string; instant: string; date: string; depart: string; arrivee: string
  vehiculeBrut: string; vehicule: CleVehiculeV2 | null; encaisse: number
  mesures: MesuresTrajet; miseDeCote: string | null
}

type ChampsVehicule = { priseEnCharge: string; prixKm: string; prixHeure: string; minimum: string }
type ChampsBase = { nom: string; adresse: string; active: boolean }

const versChamps = (g: GrilleV2) => ({
  vehicules: Object.fromEntries(VEHICULES_V2.map(v => [v, {
    priseEnCharge: String(g.vehicules[v].priseEnCharge), prixKm: String(g.vehicules[v].prixKm),
    prixHeure: String(g.vehicules[v].prixHeure), minimum: String(g.vehicules[v].minimum),
  }])) as Record<CleVehiculeV2, ChampsVehicule>,
  bases: g.bases.map(b => ({ nom: b.nom, adresse: b.adresse, active: b.active })) as ChampsBase[],
})

/** « 0,45 » comme « 0.45 » ; vide, négatif ou illisible → null. */
const lire = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function versGrille(c: ReturnType<typeof versChamps>): GrilleV2 | null {
  const vehicules = {} as GrilleV2['vehicules']
  for (const v of VEHICULES_V2) {
    const f = c.vehicules[v]
    const [p, k, h, m] = [lire(f.priseEnCharge), lire(f.prixKm), lire(f.prixHeure), lire(f.minimum)]
    if (p === null || k === null || h === null || m === null) return null
    vehicules[v] = { priseEnCharge: p, prixKm: k, prixHeure: h, minimum: m }
  }
  return { vehicules, bases: c.bases.map(b => ({ nom: b.nom, adresse: b.adresse, active: b.active })) }
}

/* Une adresse sur deux lignes : la ville (ou l'aéroport, la gare) en clair,
   la rue en dessous ; l'adresse complète au survol. Avant le 2026-11-21, seul
   le premier morceau était gardé — souvent la rue : 23 adresses sur 41
   n'affichaient aucune ville. */
function Lieu({ adresse }: { adresse: string }) {
  const l = lieuCourt(adresse)
  return (
    <span className="v2-lieu" title={adresse}>
      <span className="p">{l.principal}</span>
      {l.detail && <span className="d">{l.detail}</span>}
    </span>
  )
}
const ville = (a: string) => lieuCourt(a).principal
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

function calculer(courses: CoursePassee[], g: GrilleV2) {
  const lignes = courses.map(c => ({ c, d: prixV2(c.vehicule ?? 'berline', c.mesures, g) }))
  const retenues = lignes.filter(l => !l.c.miseDeCote)
  const encaisse = retenues.reduce((s, l) => s + l.c.encaisse, 0)
  const v2 = retenues.reduce((s, l) => s + l.d.prix, 0)
  return { lignes, retenues, encaisse, v2, plusCheres: retenues.filter(l => l.d.prix > l.c.encaisse).length }
}

export default function GrilleV2Editeur({ grilleEnregistree, enService, courses, trajetsTypes }: {
  grilleEnregistree: GrilleV2; enService: TarificationEnService; courses: CoursePassee[]; trajetsTypes: TrajetType[]
}) {
  const [champs, setChamps] = useState(() => versChamps(grilleEnregistree))
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, demarrer] = useTransition()

  const grille = useMemo(() => versGrille(champs), [champs])
  const modifie = JSON.stringify(champs) !== JSON.stringify(versChamps(grilleEnregistree))
  const reference = useMemo(() => calculer(courses, grilleEnregistree), [courses, grilleEnregistree])
  const r = useMemo(() => (grille ? calculer(courses, grille) : null), [courses, grille])

  const majVehicule = (v: CleVehiculeV2, k: keyof ChampsVehicule, val: string) => {
    setMessage(null); setChamps(c => ({ ...c, vehicules: { ...c.vehicules, [v]: { ...c.vehicules[v], [k]: val } } }))
  }
  const majBase = (i: number, patch: Partial<ChampsBase>) => {
    setMessage(null); setChamps(c => ({ ...c, bases: c.bases.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  }
  const enregistrer = () => {
    if (!grille) return
    demarrer(async () => {
      const res = await enregistrerGrilleV2(grille)
      setMessage(res.error ? { ok: false, texte: res.error } : { ok: true, texte: 'Grille v2 enregistrée. Les prix du site n’ont pas changé.' })
    })
  }

  return (
    <div className="v2" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <style>{`
        .v2-section { background: var(--surface); border: 1px solid var(--gb); border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .v2-titre { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--t2); font-weight: 500; }
        .v2-aide { font-size: 12px; color: var(--t2); line-height: 1.55; max-width: 72ch; }
        .v2-pastille { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
        .v2-service { color: var(--green, #3DB87A); background: rgba(61,184,122,.12); border: 1px solid rgba(61,184,122,.35); }
        .v2-essai { color: var(--amber, #E8A030); background: rgba(232,160,48,.12); border: 1px solid rgba(232,160,48,.35); }
        .v2-deux { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px; }
        .v2-carte { background: var(--elevated); border: 1px solid var(--gb); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 8px; }
        .v2-carte.actif { border-color: rgba(61,184,122,.45); }
        .v2-carte h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--t1); }
        .v2-tw { overflow-x: auto; }
        .v2 table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .v2 th { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--t2); font-weight: 500; text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--gb); white-space: nowrap; }
        .v2 td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.05); color: var(--t1); }
        .v2 .n { text-align: right; font-family: var(--font-jetbrains), monospace; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .v2-champ { display: flex; align-items: center; gap: 6px; }
        .v2-champ input[type=text] { width: 84px; background: var(--base); border: 1px solid var(--gb); border-radius: 7px; padding: 7px 9px; font-size: 13px; color: var(--t1); font-family: var(--font-jetbrains), monospace; text-align: right; }
        .v2-champ input[type=text]:hover { border-color: rgba(201,168,76,.4); }
        .v2-champ input[type=text]:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 1px; }
        .v2-champ input.faux { border-color: var(--red, #D95454); }
        .v2-champ span { font-size: 11px; color: var(--t2); }
        .v2-btn { border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: background-color .15s, color .15s, transform .1s; }
        .v2-btn:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 2px; }
        .v2-btn:active:not(:disabled) { transform: translateY(1px); }
        .v2-btn:disabled { opacity: .45; cursor: not-allowed; }
        .v2-btn.or { background: var(--gold, #C9A84C); color: #0b0b18; }
        .v2-btn.or:hover:not(:disabled) { background: var(--gold-bright, #DDB95A); }
        .v2-btn.neutre { background: transparent; color: var(--t1); border-color: var(--gb); }
        .v2-btn.neutre:hover:not(:disabled) { background: var(--elevated); }
        .v2-lien { color: var(--gold, #C9A84C); text-decoration: underline; text-underline-offset: 3px; }
        .v2-lien:hover { color: var(--gold-bright, #DDB95A); }
        .v2-lien:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 2px; }
        .v2-tuiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 10px; }
        .v2-tuile { background: var(--elevated); border: 1px solid var(--gb); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
        .v2-tuile .l { font-size: 11.5px; color: var(--t2); }
        .v2-tuile .v { font-family: var(--font-jetbrains), monospace; font-size: 20px; color: var(--t1); }
        .v2-tuile .s { font-size: 11px; color: var(--t2); }
        .v2-lieu { display: flex; flex-direction: column; gap: 1px; min-width: 150px; max-width: 240px; }
        .v2-lieu .p { font-weight: 500; color: var(--t1); }
        .v2-lieu .d { font-size: 11.5px; color: var(--t2); overflow-wrap: anywhere; }
        .plus { color: var(--amber, #E8A030); } .moins { color: var(--green, #3DB87A); }
        .v2 summary { cursor: pointer; color: var(--t2); font-size: 12.5px; }
        .v2 summary:hover { color: var(--t1); }
        .v2 summary:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 2px; }
        @media (max-width: 900px) { .v2 { padding: 20px 16px !important; } .v2-section { padding: 18px 14px; } }
      `}</style>

      {/* Les deux tarifications, et laquelle est en service */}
      <section className="v2-section" aria-labelledby="v2-deux">
        <div className="v2-titre" id="v2-deux">Les deux tarifications</div>
        <div className="v2-deux">
          <div className={`v2-carte${enService === 'actuelle' ? ' actif' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <h3>Tarification actuelle</h3>
              <span className={`v2-pastille ${enService === 'actuelle' ? 'v2-service' : 'v2-essai'}`}>{enService === 'actuelle' ? 'En service' : 'Hors service'}</span>
            </div>
            <p className="v2-aide" style={{ margin: 0 }}>Forfaits par zones et prix au kilomètre. <strong>Ce sont les prix que voient vos clients</strong> sur le site, dans les devis et à la réservation.</p>
            <Link href="/admin/tarifs" className="v2-lien" style={{ fontSize: 12.5 }}>La régler dans « Tarifs »</Link>
          </div>
          <div className={`v2-carte${enService === 'v2' ? ' actif' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <h3>Tarification v2</h3>
              <span className={`v2-pastille ${enService === 'v2' ? 'v2-service' : 'v2-essai'}`}>{enService === 'v2' ? 'En service' : 'En essai'}</span>
            </div>
            <p className="v2-aide" style={{ margin: 0 }}>Une seule grille par véhicule, aller-retour depuis le départ du client. <strong>Aucun client ne voit ces prix</strong> : vous pouvez la régler librement.</p>
            <p className="v2-aide" style={{ margin: 0 }}>La mise en service se fera sur votre décision, à l’étape 5 du projet. Le bouton pour basculer de l’une à l’autre sera ajouté à ce moment-là.</p>
          </div>
        </div>
      </section>

      {/* La grille */}
      <section className="v2-section" aria-labelledby="v2-grille">
        <div className="v2-titre" id="v2-grille">La grille v2 — une ligne par véhicule</div>
        <p className="v2-aide" style={{ margin: 0 }}>Prix d’un trajet = prise en charge + kilomètres × prix du km + heures × prix de l’heure, arrondi à l’euro supérieur, jamais sous le minimum. Kilomètres et heures comptent le circuit réel du chauffeur : de sa base jusqu’au client, le trajet du client, puis le retour de l’arrivée jusqu’à sa base. La règle est la même pour tous les trajets et tous les véhicules ; changer une case change tous les trajets de ce véhicule.</p>
        <div className="v2-tw">
          <table style={{ minWidth: 640 }}>
            <thead><tr><th>Véhicule</th><th>Prise en charge</th><th>Prix du km</th><th>Prix de l’heure</th><th>Minimum</th></tr></thead>
            <tbody>
              {VEHICULES_V2.map(v => (
                <tr key={v}>
                  <td style={{ fontWeight: 500 }}>{NOM_VEHICULE_V2[v]}</td>
                  {([['priseEnCharge', '€'], ['prixKm', '€/km'], ['prixHeure', '€/h'], ['minimum', '€']] as const).map(([k, u]) => (
                    <td key={k}>
                      <label className="v2-champ">
                        <input type="text" inputMode="decimal" value={champs.vehicules[v][k]}
                          className={lire(champs.vehicules[v][k]) === null ? 'faux' : ''}
                          aria-label={`${NOM_VEHICULE_V2[v]} — ${k}`}
                          onChange={e => majVehicule(v, k, e.target.value)} />
                        <span>{u}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="v2-titre" style={{ marginTop: 8 }}>Les bases</div>
        <p className="v2-aide" style={{ margin: 0 }}>Les bases d’où partent et où rentrent les chauffeurs. Pour chaque trajet, on retient la base qui donne le prix le plus bas. Une base désactivée n’est plus proposée.</p>
        <div className="v2-tw">
          <table style={{ minWidth: 360 }}>
            <thead><tr><th>Base</th><th>Adresse</th><th>Active</th></tr></thead>
            <tbody>
              {champs.bases.map((b, i) => (
                <tr key={b.nom}>
                  <td style={{ fontWeight: 500 }}>{b.nom}</td>
                  <td className="v2-gris">{b.adresse}</td>
                  <td><label className="v2-champ"><input type="checkbox" checked={b.active} onChange={e => majBase(i, { active: e.target.checked })} /><span>{b.active ? 'Oui' : 'Non'}</span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="v2-btn or" disabled={!grille || !modifie || enCours} onClick={enregistrer}>{enCours ? 'Enregistrement…' : 'Enregistrer la grille v2'}</button>
          <button type="button" className="v2-btn neutre" disabled={!modifie || enCours} onClick={() => { setMessage(null); setChamps(versChamps(grilleEnregistree)) }}>Revenir à la grille enregistrée</button>
          {!grille && <span role="alert" style={{ fontSize: 12.5, color: 'var(--red, #D95454)' }}>Une case est vide ou invalide (en rouge).</span>}
          {grille && modifie && !message && <span style={{ fontSize: 12.5, color: 'var(--amber, #E8A030)' }}>Modifications non enregistrées — l’effet ci-dessous est déjà calculé.</span>}
          {message && <span role="status" style={{ fontSize: 12.5, color: message.ok ? 'var(--green, #3DB87A)' : 'var(--red, #D95454)' }}>{message.texte}</span>}
        </div>
      </section>

      {/* Simulateur et banc de trajets : la grille en cours de saisie si elle est
          valide, sinon la grille enregistrée (une case vide ne vide pas l'écran). */}
      <Simulations grille={grille ?? grilleEnregistree} trajetsTypes={trajetsTypes} />

      {/* L'effet sur les courses passées */}
      {r && (
        <section className="v2-section" aria-labelledby="v2-effet">
          <div className="v2-titre" id="v2-effet">L’effet sur vos {r.retenues.length} courses passées</div>
          <div className="v2-tuiles">
            <div className="v2-tuile"><span className="l">Encaissé (tarification actuelle)</span><span className="v">{formaterMontant(r.encaisse)}</span></div>
            <div className="v2-tuile"><span className="l">Avec cette grille v2</span><span className="v">{formaterMontant(r.v2)}</span>
              <span className="s">{modifie ? `grille enregistrée : ${formaterMontant(reference.v2)}` : 'grille enregistrée'}</span></div>
            <div className="v2-tuile"><span className="l">Écart</span><span className={`v ${r.v2 > r.encaisse ? 'plus' : 'moins'}`}>{pct(r.encaisse ? (r.v2 / r.encaisse - 1) * 100 : 0)}</span></div>
            <div className="v2-tuile"><span className="l">Courses plus chères en v2</span><span className="v">{r.plusCheres} / {r.retenues.length}</span></div>
          </div>
          <p className="v2-aide" style={{ margin: 0 }}>Sans commission. Distances et durées mesurées par Google (durée normale, sans bouchons) ; péages non comptés.</p>
          <div className="v2-tw">
            <table style={{ minWidth: 900 }}>
              <thead><tr><th>Date</th><th>Départ</th><th>Arrivée</th><th>Véhicule</th><th>Base</th><th className="n">Km facturés</th><th className="n">Encaissé</th><th className="n">Prix v2</th><th className="n">Écart</th></tr></thead>
              <tbody>
                {r.retenues.map(({ c, d }) => (
                  <tr key={c.id}>
                    <td className="n" style={{ textAlign: 'left' }}>{c.date}</td>
                    <td><Lieu adresse={c.depart} /></td>
                    <td><Lieu adresse={c.arrivee} /></td>
                    <td>{c.vehicule ? NOM_VEHICULE_V2[c.vehicule] : `${c.vehiculeBrut} (compté berline)`}</td>
                    <td>{d.base ?? 'aucune'}{d.auMinimum ? ' · minimum' : ''}</td>
                    <td className="n">{Math.round(d.kmFactures)} km</td>
                    <td className="n">{formaterMontant(c.encaisse)}</td>
                    <td className="n">{formaterMontant(d.prix)}</td>
                    <td className={`n ${d.prix > c.encaisse ? 'plus' : 'moins'}`}>{d.prix > c.encaisse ? '+' : ''}{formaterMontant(d.prix - c.encaisse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.lignes.some(l => l.c.miseDeCote) && (
            <details>
              <summary>{r.lignes.filter(l => l.c.miseDeCote).length} courses mises de côté (hors normes), non comptées</summary>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--t2)', display: 'grid', gap: 4 }}>
                {r.lignes.filter(l => l.c.miseDeCote).map(({ c, d }) => (
                  <li key={c.id}>{c.date} · {ville(c.depart)} → {ville(c.arrivee)} ·encaissé {formaterMontant(c.encaisse)}, v2 {formaterMontant(d.prix)} — {c.miseDeCote}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  )
}
