import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { jourParis, debutJourParis, aujourdhuiParis } from '@/lib/heure'
import { formaterMontant } from '@/lib/montant'
import { STATUTS, dateCourte, type DevisClient } from '@/lib/devis-client'
import NouveauBouton from './NouveauBouton'

export const dynamic = 'force-dynamic'

/* Chaque statut porte sa couleur : sur une liste, l'état se lit avant le
   texte. Les teintes viennent de la charte, pas d'une palette inventée. */
const TEINTE: Record<string, { fond: string; trait: string; encre: string }> = {
  brouillon: { fond: 'rgba(201,168,76,.12)',         trait: 'rgba(201,168,76,.12)',        encre: 'var(--t3)' },
  envoye:    { fond: 'rgba(201,168,76,.12)',    trait: 'rgba(201,168,76,.30)',   encre: 'var(--gold)' },
  accepte:   { fond: 'rgba(61,184,122,.12)',    trait: 'rgba(61,184,122,.32)',   encre: 'var(--grn)' },
  refuse:    { fond: 'rgba(217,84,84,.10)',     trait: 'rgba(217,84,84,.28)',    encre: 'var(--red-txt)' },
  expire:    { fond: 'rgba(201,168,76,.12)',         trait: 'rgba(201,168,76,.12)',        encre: 'var(--t3)' },
}

/**
 * « il y a 3 jours » — depuis combien de temps la demande attend.
 *
 * L'APPELANT ne l'affiche que sur un devis encore en attente (brouillon ou
 * envoye) : sur un devis accepte ou refuse, l'anciennete n'apprend rien et
 * ferait du bruit. Le calcul se fait en JOURS DE PARIS, jamais en heures :
 * deux instants a quelques heures d'ecart peuvent etre deux jours
 * differents.
 */
function attente(cree: string): string {
  const a = debutJourParis(jourParis(cree)).getTime()
  const b = debutJourParis(aujourdhuiParis()).getTime()
  const jours = Math.round((b - a) / 86400000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  return `il y a ${jours} jours`
}

export default async function DevisClientsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('devis_clients')
    .select('*')
    .order('created_at', { ascending: false })

  const devis = (data ?? []) as DevisClient[]
  const enCours = devis.filter(d => d.statut === 'brouillon' || d.statut === 'envoye').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300 }}>

      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: 'var(--t1)', margin: 0 }}>
            Devis clients
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
            Les devis que vous adressez — plusieurs trajets, un seul document
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,.12), rgba(201,168,76,.06))',
            border: '1px solid rgba(201,168,76,.25)',
            borderRadius: 10, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{enCours}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>En cours</div>
          </div>
          <NouveauBouton />
        </div>
      </div>

      {devis.length === 0 ? (
        <div style={{ background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 12, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 6 }}>Aucun devis pour le moment.</div>
          <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>
            « Nouveau devis » crée un brouillon que vous remplissez ligne par ligne.
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 12, overflow: 'hidden' }}>
          {devis.map((d, i) => {
            const t = TEINTE[d.statut] ?? TEINTE.brouillon
            return (
              <Link
                key={d.id}
                href={`/admin/devis-clients/${d.id}`}
                /* `dc-ligne` : sous 900 px, ces cinq colonnes deviennent une
                   carte. Mesuré le 2026-11-05 : la colonne du client tombait
                   à quelques pixels et le texte se lisait verticalement, une
                   lettre par ligne — « 1 p r e s t a t i o n ». */
                className="dc-ligne"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(130px,auto) minmax(0,1fr) auto auto auto',
                  gap: 16, alignItems: 'center', padding: '15px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(201,168,76,.12)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <span className="dc-numero" style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#C9A84C', letterSpacing: '.03em' }}>
                  {d.numero}
                </span>

                <span className="dc-client" style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.client_nom || <em style={{ color: 'var(--t3)', fontWeight: 400 }}>Sans nom</em>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                    {d.client_societe ? d.client_societe + ' · ' : ''}
                    {d.lignes.length} prestation{d.lignes.length > 1 ? 's' : ''}
                    {/* « pour le », en face de « Créé le » dessous : deux dates
                       nues l'une au-dessus de l'autre se confondent. */}
                    {d.date_prestation ? ' · pour le ' + dateCourte(d.date_prestation) : ''}
                  </span>
                  {/* LA DATE DE RECEPTION, demandee par l'exploitant le
                      2026-11-12 : « je vois le jour ou ça a été fait et le
                      jour où la prestation a lieu ». Elle dit depuis quand la
                      demande attend, ce que la date de prestation ne dit pas.

                      `jourParis`, et surtout PAS `created_at.slice(0, 10)` :
                      `created_at` est un INSTANT. Le serveur Vercel tourne en
                      temps universel, le navigateur a Paris — un devis cree a
                      00h30 serait date de la veille sur l'un et du jour sur
                      l'autre. Regle du projet, src/lib/heure.ts. */}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginTop: 3, opacity: .85 }}>
                    Créé le{' '}
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {dateCourte(jourParis(d.created_at))}
                    </span>
                    {(d.statut === 'brouillon' || d.statut === 'envoye') && (
                      <span style={{ color: 'var(--amb)' }}> · {attente(d.created_at)}</span>
                    )}
                  </span>
                </span>

                <span className="dc-statut" style={{
                  fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600,
                  background: t.fond, border: `1px solid ${t.trait}`, color: t.encre,
                  borderRadius: 20, padding: '3px 11px', whiteSpace: 'nowrap',
                }}>
                  {STATUTS[d.statut] ?? d.statut}
                </span>

                <span className="dc-montant" style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 500, color: 'var(--t1)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {formaterMontant(Number(d.total_ht))}
                </span>

                <span className="dc-ouvrir" style={{ fontSize: 12, color: '#C9A84C', whiteSpace: 'nowrap' }}>Ouvrir →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
