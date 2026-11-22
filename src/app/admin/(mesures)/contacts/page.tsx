/**
 * /admin/contacts — « Appels & WhatsApp » : les clics vers le téléphone, le
 * WhatsApp et l'e-mail d'Owise, et d'où venaient ceux qui ont cliqué.
 *
 * Demandé par l'exploitant le 2026-11-22. Table `contacts_clics`, écrite par
 * /api/contacts-clics ; ce qui est mesuré est décrit dans src/lib/contact-clic.ts.
 *
 * Un clic n'est pas un appel abouti : la personne peut raccrocher avant de
 * composer. L'écran le dit, et il se lit à côté du journal d'appels réel.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NOM_PAR_CLE } from '@/lib/gamme'
import { LIBELLE_CANAL, CANAUX_ASSISTANTS } from '@/lib/origine-visite'
import { formaterAParis } from '@/lib/heure'
import { formaterMontant } from '@/lib/montant'

export const dynamic = 'force-dynamic'

type Clic = {
  id: string; created_at: string; type: 'telephone' | 'whatsapp' | 'email'
  emplacement: string | null; page: string; premiere_page: string | null; parcours: string[]
  secondes_avant_clic: number | null
  derniere_estimation: { depart: string; arrivee: string; vehicule: string | null; prix: number | null; il_y_a_s: number | null } | null
  canal: string | null; referent: string | null; utm_campaign: string | null
  appareil: string | null; langue: string | null; largeur_ecran: number | null
}

const TYPE: Record<Clic['type'], { nom: string; couleur: string }> = {
  telephone: { nom: 'Téléphone', couleur: 'var(--gold, #C9A84C)' },
  whatsapp:  { nom: 'WhatsApp',  couleur: 'var(--green, #3DB87A)' },
  email:     { nom: 'E-mail',    couleur: 'var(--blue, #4D8ED4)' },
}
const APPAREIL: Record<string, string> = { mobile: 'Téléphone', tablette: 'Tablette', ordinateur: 'Ordinateur' }
const canal = (c: string | null) => (c ? LIBELLE_CANAL[c] ?? c : '—')
const duree = (s: number | null) => s == null ? '—' : s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`
const lieu = (l: string) => l.replace(/^[A-Z]{2,4}, /, '')

function compter<T>(liste: T[], cle: (x: T) => string) {
  const m = new Map<string, number>()
  for (const x of liste) m.set(cle(x), (m.get(cle(x)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function Tableau({ titre, lignes, total, nom }: { titre: string; lignes: [string, number][]; total: number; nom?: (k: string) => React.ReactNode }) {
  return (
    <div className="ct-bloc">
      <div className="ct-titre">{titre}</div>
      {lignes.length === 0 ? <p className="ct-vide">Rien encore.</p> : (
        <table><tbody>
          {lignes.slice(0, 12).map(([k, n]) => (
            <tr key={k}>
              <td>{nom ? nom(k) : k}</td>
              <td className="n">{n}</td>
              <td className="n ct-gris">{Math.round((n / total) * 100)} %</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}

export default async function ContactsPage() {
  const sb = createAdminClient()
  const depuis = new Date(Date.now() - 90 * 86400_000).toISOString()
  const { data, error } = await sb.from('contacts_clics')
    .select('id, created_at, type, emplacement, page, premiere_page, parcours, secondes_avant_clic, derniere_estimation, canal, referent, utm_campaign, appareil, langue, largeur_ecran')
    .gte('created_at', depuis).order('created_at', { ascending: false }).limit(1000)
  const clics = (data ?? []) as Clic[]
  const limite30 = Date.now() - 30 * 86400_000
  const c30 = clics.filter(c => new Date(c.created_at).getTime() >= limite30)
  const avecPrix = c30.filter(c => c.derniere_estimation).length

  return (
    <div className="ct" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <style>{`
        .ct h1 { font-family: var(--font-cormorant, Georgia), serif; font-size: 28px; font-weight: 500; color: var(--t1); margin: 0; }
        .ct-aide { font-size: 12.5px; color: var(--t2); line-height: 1.55; max-width: 80ch; margin: 0; }
        .ct-tuiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: 10px; }
        .ct-tuile { background: var(--elevated); border: 1px solid var(--gb); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
        .ct-tuile .l { font-size: 11.5px; color: var(--t2); }
        .ct-tuile .v { font-family: var(--font-jetbrains), monospace; font-size: 22px; color: var(--t1); font-variant-numeric: tabular-nums; }
        .ct-grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; }
        .ct-bloc { background: var(--surface); border: 1px solid var(--gb); border-radius: 12px; padding: 16px 18px; min-width: 0; }
        .ct-titre { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--t2); font-weight: 500; margin-bottom: 10px; }
        .ct table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .ct td, .ct th { padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,.05); color: var(--t1); text-align: left; vertical-align: top; }
        .ct th { font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--t2); font-weight: 500; white-space: nowrap; }
        .ct .n { text-align: right; font-family: var(--font-jetbrains), monospace; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .ct-gris { color: var(--t2) !important; font-size: 12px; }
        .ct-vide { font-size: 12.5px; color: var(--t2); margin: 0; }
        .ct-tw { overflow-x: auto; }
        .ct-pastille { font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
        .ct-chemin { font-size: 11.5px; color: var(--t2); overflow-wrap: anywhere; }
        @media (max-width: 900px) { .ct { padding: 20px 16px !important; } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1>Appels &amp; WhatsApp</h1>
        <p className="ct-aide">Chaque fois qu’un visiteur touche « Appeler », WhatsApp ou l’e-mail d’Owise sur le site : d’où il venait, quelles pages il a vues, et quel prix il venait de voir. Mesure anonyme, sans nom ni numéro. <strong>Un clic n’est pas forcément un appel abouti</strong> : rapprochez-le de votre journal d’appels. Mesure en place depuis le 22 novembre 2026.</p>
        {error && <p role="alert" style={{ color: 'var(--red, #D95454)', fontSize: 13, margin: 0 }}>Lecture impossible : {error.message}</p>}
      </div>

      <div className="ct-tuiles">
        <div className="ct-tuile"><span className="l">Clics, 30 derniers jours</span><span className="v">{c30.length}</span></div>
        {(['telephone', 'whatsapp', 'email'] as const).map(t => (
          <div className="ct-tuile" key={t}><span className="l">{TYPE[t].nom}</span><span className="v" style={{ color: TYPE[t].couleur }}>{c30.filter(c => c.type === t).length}</span></div>
        ))}
        <div className="ct-tuile"><span className="l">Après avoir vu un prix</span><span className="v">{c30.length ? `${Math.round((avecPrix / c30.length) * 100)} %` : '—'}</span></div>
      </div>

      <div className="ct-grille">
        <Tableau titre="D’où venaient-ils (30 j)" total={c30.length || 1} lignes={compter(c30, c => c.canal ?? 'direct')}
          nom={k => <span style={{ color: CANAUX_ASSISTANTS.has(k) ? 'var(--gold, #C9A84C)' : undefined, fontWeight: CANAUX_ASSISTANTS.has(k) ? 600 : 400 }}>{canal(k)}</span>} />
        <Tableau titre="Sur quelle page (30 j)" total={c30.length || 1} lignes={compter(c30, c => c.page)} />
        <Tableau titre="Quel bouton (30 j)" total={c30.length || 1} lignes={compter(c30, c => c.emplacement ?? '—')} />
        <Tableau titre="Appareil (30 j)" total={c30.length || 1} lignes={compter(c30, c => c.appareil ?? '—')} nom={k => APPAREIL[k] ?? k} />
      </div>

      <div className="ct-bloc">
        <div className="ct-titre">{clics.length ? `Les ${Math.min(clics.length, 200)} derniers clics (90 jours)` : 'Les derniers clics'}</div>
        {clics.length === 0 ? <p className="ct-vide">Aucun clic enregistré pour l’instant. Le premier apparaîtra ici dès qu’un visiteur touchera « Appeler » ou WhatsApp.</p> : (
          <div className="ct-tw">
            <table style={{ minWidth: 980 }}>
              <thead><tr><th>Quand</th><th>Contact</th><th>Provenance</th><th>Page · bouton</th><th>Prix vu juste avant</th><th>Parcours</th><th className="n">Sur le site</th><th>Appareil</th></tr></thead>
              <tbody>
                {clics.slice(0, 200).map(c => {
                  const e = c.derniere_estimation
                  return (
                    <tr key={c.id}>
                      <td className="n" style={{ textAlign: 'left' }}>{formaterAParis(c.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><span className="ct-pastille" style={{ color: TYPE[c.type].couleur }}>{TYPE[c.type].nom}</span></td>
                      <td>{canal(c.canal)}{c.utm_campaign ? <div className="ct-chemin">campagne {c.utm_campaign}</div> : null}{c.referent && !['direct', 'interne'].includes(c.canal ?? '') ? <div className="ct-chemin" title={c.referent}>{c.referent.replace(/^https?:\/\//, '').slice(0, 40)}</div> : null}</td>
                      <td>{c.page}<div className="ct-chemin">{c.emplacement ?? ''}</div></td>
                      <td>{e ? <>{lieu(e.depart)} → {lieu(e.arrivee)}<div className="ct-chemin">{formaterMontant(e.prix)}{e.vehicule ? ` · ${NOM_PAR_CLE[e.vehicule as keyof typeof NOM_PAR_CLE] ?? e.vehicule}` : ''}{e.il_y_a_s != null ? ` · il y a ${duree(e.il_y_a_s)}` : ''}</div></> : <span className="ct-gris">aucun</span>}</td>
                      <td className="ct-chemin" style={{ maxWidth: 260 }}>{c.parcours.length ? c.parcours.join(' → ') : '—'}</td>
                      <td className="n">{duree(c.secondes_avant_clic)}</td>
                      <td className="ct-gris">{APPAREIL[c.appareil ?? ''] ?? '—'}{c.langue ? ` · ${c.langue.toUpperCase()}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
