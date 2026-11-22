'use client'

/**
 * Simulateur libre et banc de trajets types — /admin/tarification-v2.
 *
 * Demandé par l'exploitant le 2026-11-21 : « je peux pas faire des simulations
 * sur la tarification V2 … toutes les destinations … des tests réalistes »,
 * plutôt que les seules courses passées.
 *
 *  · Simulateur : un trajet quelconque, mesuré par Google à la demande
 *    (simulerTrajet, n'écrit rien). Prix actuel du site pour les 4 véhicules,
 *    prix v2 recalculé en direct quand la grille bouge.
 *  · Banc : chaque commune d'une page ville → CDG, Orly, Beauvais, Paris
 *    (table v2_trajets_types, mesurée une fois). Même principe.
 *
 * Le prix v2 vient de `prixV2` (grille.ts) ; le prix actuel, du serveur
 * (prix-actuel.ts, chemin de la vitrine). Rien n'est recopié ici.
 */
import { useMemo, useState, useTransition } from 'react'
import { prixV2, type CleVehiculeV2, type GrilleV2, type MesuresTrajet, type DetailPrix } from '@/lib/tarification-v2/grille'
import { VEHICULES_V2, NOM_VEHICULE_V2 } from '@/lib/tarification-v2/grille-db'
import type { PrixActuel } from '@/lib/tarification-v2/prix-actuel'
import { lieuCourt } from '@/lib/tarification-v2/lieu-court'
import { formaterMontant } from '@/lib/montant'
import { simulerTrajet, type ResultatSimulation } from './actions'

export type TrajetType = {
  id: string; groupe: string; depart: string; arrivee: string
  mesures: MesuresTrajet; actuel: Record<CleVehiculeV2, PrixActuel>
}
type Simulation = Extract<ResultatSimulation, { mesures: MesuresTrajet }> & { cle: number }

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
const minutes = (m: number) => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? `${h} h ${String(r).padStart(2, '0')}` : `${r} min` }
/* « Creil 60100, France » → « Creil » : libellé du banc, écrit comme une saisie client. */
const commune = (s: string) => s.replace(/\s+\d{5}\s*,?\s*France\s*$/i, '').replace(/,\s*France\s*$/i, '')

function Ecart({ actuel, v2 }: { actuel: number | null | undefined; v2: number }) {
  if (actuel == null) return <span className="v2-gris">—</span>
  const e = v2 - actuel
  return <span className={e > 0 ? 'plus' : e < 0 ? 'moins' : ''}>{e > 0 ? '+' : ''}{formaterMontant(e)}</span>
}
function Actuel({ p }: { p: PrixActuel }) {
  if (!p) return <span className="v2-gris">pas de prix</span>
  return <>{formaterMontant(p.prix)} <span className="v2-mode">{p.mode === 'forfait' ? 'forfait' : 'au km'}</span></>
}
function DetailV2({ d }: { d: DetailPrix }) {
  return (
    <span className="v2-gris" style={{ fontSize: 11.5 }}>
      {Math.round(d.kmFactures)} km · {minutes(d.minFactures)} facturés · base {d.base ?? 'aucune'}
      {d.eloignementKm > 0 ? ` (+${Math.round(d.eloignementKm)} km d’approche)` : ''}{d.auMinimum ? ' · au minimum' : ''}
    </span>
  )
}

export default function Simulations({ grille, trajetsTypes }: { grille: GrilleV2; trajetsTypes: TrajetType[] }) {
  /* ── Simulateur ── */
  const [depart, setDepart] = useState('Chantilly 60500, France')
  const [arrivee, setArrivee] = useState('Aéroport Paris-Charles de Gaulle (CDG)')
  const [sims, setSims] = useState<Simulation[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const calculer = () => {
    setErreur(null)
    demarrer(async () => {
      const r = await simulerTrajet(depart, arrivee)
      if ('erreur' in r) setErreur(r.erreur)
      else setSims(s => [{ ...r, cle: Date.now() }, ...s].slice(0, 12))
    })
  }

  /* ── Banc ── */
  const [vehicule, setVehicule] = useState<CleVehiculeV2>('berline')
  const groupes = useMemo(() => [...new Set(trajetsTypes.map(t => t.groupe))], [trajetsTypes])
  const [groupe, setGroupe] = useState<string>('Tous')
  const banc = useMemo(() => trajetsTypes
    .filter(t => groupe === 'Tous' || t.groupe === groupe)
    .map(t => ({ t, a: t.actuel[vehicule], d: prixV2(vehicule, t.mesures, grille) })), [trajetsTypes, groupe, vehicule, grille])
  const comparables = banc.filter(l => l.a)
  const totA = comparables.reduce((s, l) => s + l.a!.prix, 0)
  const totV = comparables.reduce((s, l) => s + l.d.prix, 0)
  const plusChers = comparables.filter(l => l.d.prix > l.a!.prix).length

  return (
    <>
      <style>{`
        .v2-gris { color: var(--t2); }
        .v2-mode { font-family: var(--font-dm-sans, system-ui), sans-serif; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--t2); margin-left: 4px; }
        .v2-sim-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
        .v2-sim-form label { display: flex; flex-direction: column; gap: 5px; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--t2); font-weight: 500; }
        .v2-sim-form input { background: var(--base); border: 1px solid var(--gb); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; color: var(--t1); width: 100%; box-sizing: border-box; text-transform: none; letter-spacing: 0; }
        .v2-sim-form input:hover { border-color: rgba(201,168,76,.4); }
        .v2-sim-form input:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 1px; }
        .v2-carte-sim { background: var(--elevated); border: 1px solid var(--gb); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .v2-carte-sim header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
        .v2-trajet { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .v2-fleche { color: var(--gold, #C9A84C); }
        .v2-puces { display: flex; gap: 6px; flex-wrap: wrap; }
        .v2-puce { background: transparent; border: 1px solid var(--gb); color: var(--t1); border-radius: 99px; padding: 6px 12px; font-size: 12.5px; cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
        .v2-puce:hover { border-color: rgba(201,168,76,.45); }
        .v2-puce:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 2px; }
        .v2-puce:active { transform: translateY(1px); }
        .v2-puce[aria-pressed="true"] { background: rgba(201,168,76,.14); border-color: var(--gold, #C9A84C); color: var(--gold-bright, #DDB95A); }
        .v2-retirer { background: none; border: none; color: var(--t2); font-size: 12px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .v2-retirer:hover { color: var(--t1); }
        .v2-retirer:focus-visible { outline: 2px solid var(--gold, #C9A84C); outline-offset: 2px; }
        @media (max-width: 700px) { .v2-sim-form { grid-template-columns: 1fr; } }
      `}</style>

      {/* Simulateur libre */}
      <section className="v2-section" aria-labelledby="v2-sim">
        <div className="v2-titre" id="v2-sim">Simulateur — n’importe quel trajet</div>
        <p className="v2-aide" style={{ margin: 0 }}>Écrivez un départ et une arrivée comme un client les taperait. Google mesure le trajet ; vous voyez le prix actuel du site et le prix v2 pour les quatre véhicules. Le prix v2 suit la grille au-dessus en direct. Rien n’est enregistré.</p>
        <form className="v2-sim-form" onSubmit={e => { e.preventDefault(); calculer() }}>
          <label>Départ<input type="text" value={depart} onChange={e => setDepart(e.target.value)} placeholder="ex. 12 rue de la République, Senlis" /></label>
          <label>Arrivée<input type="text" value={arrivee} onChange={e => setArrivee(e.target.value)} placeholder="ex. Aéroport de Paris-Orly (ORY)" /></label>
          <button type="submit" className="v2-btn or" disabled={enCours}>{enCours ? 'Mesure…' : 'Calculer'}</button>
        </form>
        {erreur && <span role="alert" style={{ fontSize: 12.5, color: 'var(--red, #D95454)' }}>{erreur}</span>}
        {sims.map(s => {
          const det = prixV2('berline', s.mesures, grille)
          return (
            <article key={s.cle} className="v2-carte-sim">
              <header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="v2-trajet">
                    <span className="v2-lieu" title={s.depart.libelleGoogle}><span className="p">{lieuCourt(s.depart.libelleGoogle).principal}</span><span className="d">{s.depart.saisie}</span></span>
                    <span className="v2-fleche" aria-hidden="true">→</span>
                    <span className="v2-lieu" title={s.arrivee.libelleGoogle}><span className="p">{lieuCourt(s.arrivee.libelleGoogle).principal}</span><span className="d">{s.arrivee.saisie}</span></span>
                  </div>
                  <span className="v2-gris" style={{ fontSize: 11.5 }}>Trajet {Math.round(s.mesures.trajet.km)} km · {minutes(s.mesures.trajet.min)} — retour au départ {Math.round(s.mesures.retour.km)} km · {minutes(s.mesures.retour.min)}</span>
                  <DetailV2 d={det} />
                </div>
                <button type="button" className="v2-retirer" onClick={() => setSims(x => x.filter(y => y.cle !== s.cle))}>Retirer</button>
              </header>
              <div className="v2-tw">
                <table style={{ minWidth: 460 }}>
                  <thead><tr><th>Véhicule</th><th className="n">Prix actuel</th><th className="n">Prix v2</th><th className="n">Écart</th></tr></thead>
                  <tbody>
                    {VEHICULES_V2.map(v => { const d = prixV2(v, s.mesures, grille); return (
                      <tr key={v}><td>{NOM_VEHICULE_V2[v]}</td><td className="n"><Actuel p={s.actuel[v]} /></td><td className="n">{formaterMontant(d.prix)}</td><td className="n"><Ecart actuel={s.actuel[v]?.prix} v2={d.prix} /></td></tr>
                    ) })}
                  </tbody>
                </table>
              </div>
            </article>
          )
        })}
      </section>

      {/* Banc de trajets types */}
      <section className="v2-section" aria-labelledby="v2-banc">
        <div className="v2-titre" id="v2-banc">Toutes vos destinations — {trajetsTypes.length} trajets types</div>
        <p className="v2-aide" style={{ margin: 0 }}>Chaque commune de vos pages villes vers Roissy-CDG, Orly, Beauvais et Paris (Châtelet). Prix actuel = celui que le site affiche aujourd’hui (sans majoration de nuit ni de week-end). Prix v2 = la grille au-dessus, en direct.</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="v2-puces" role="group" aria-label="Véhicule">
            {VEHICULES_V2.map(v => <button key={v} type="button" className="v2-puce" aria-pressed={vehicule === v} onClick={() => setVehicule(v)}>{NOM_VEHICULE_V2[v]}</button>)}
          </div>
          <div className="v2-puces" role="group" aria-label="Destination">
            {['Tous', ...groupes].map(g => <button key={g} type="button" className="v2-puce" aria-pressed={groupe === g} onClick={() => setGroupe(g)}>{g === 'Tous' ? 'Toutes destinations' : g}</button>)}
          </div>
        </div>
        <div className="v2-tuiles">
          <div className="v2-tuile"><span className="l">Total au prix actuel</span><span className="v">{formaterMontant(totA)}</span><span className="s">{comparables.length} trajets</span></div>
          <div className="v2-tuile"><span className="l">Total en v2</span><span className="v">{formaterMontant(totV)}</span></div>
          <div className="v2-tuile"><span className="l">Écart</span><span className={`v ${totV > totA ? 'plus' : 'moins'}`}>{pct(totA ? (totV / totA - 1) * 100 : 0)}</span></div>
          <div className="v2-tuile"><span className="l">Plus chers en v2</span><span className="v">{plusChers} / {comparables.length}</span></div>
        </div>
        <div className="v2-tw">
          <table style={{ minWidth: 760 }}>
            <thead><tr><th>Départ</th><th>Destination</th><th className="n">Prix actuel</th><th className="n">Prix v2</th><th className="n">Écart</th><th>Détail v2</th></tr></thead>
            <tbody>
              {banc.map(({ t, a, d }) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{commune(t.depart)}</td>
                  <td>{t.groupe}</td>
                  <td className="n"><Actuel p={a} /></td>
                  <td className="n">{formaterMontant(d.prix)}</td>
                  <td className="n"><Ecart actuel={a?.prix} v2={d.prix} /></td>
                  <td><DetailV2 d={d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
