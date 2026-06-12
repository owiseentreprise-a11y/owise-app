import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import PayerButton from './PayerButton'

export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  payee:      'Payée',
  retard:     'En retard',
}
const STATUT_COLOR: Record<string, string> = {
  en_attente: 'var(--amb)',
  payee:      'var(--grn)',
  retard:     'var(--red)',
}

export default async function ClientFacturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paid?: string }>
}) {
  const { id } = await params
  const { paid } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Sécurité : seul un client entreprise peut voir ses propres factures
  const { data: clientData } = await supabase
    .from('clients')
    .select('id, type_compte, entreprise_nom, adresse_facturation, profiles(prenom, nom, telephone, email)')
    .eq('id', user.id)
    .single()

  if (!clientData || clientData.type_compte !== 'entreprise') redirect('/espace-client')

  const [factureRes, coursesRes, parametresRes] = await Promise.all([
    supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('client_id', user.id)  // vérifie que la facture appartient bien à ce client
      .single(),
    supabase
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, prix_final, prix_estime')
      .eq('facture_id', id)
      .order('date_prevue', { ascending: true }),
    supabase
      .from('parametres')
      .select('societe_nom, societe_adresse, societe_code_postal, societe_ville, societe_siret, societe_tva_numero, societe_email, societe_telephone, banque_iban, banque_bic, banque_nom, facture_mentions')
      .eq('id', true)
      .single(),
  ])

  if (!factureRes.data) notFound()

  const facture = factureRes.data
  const courses = coursesRes.data ?? []
  const params2 = parametresRes.data

  const statColor = STATUT_COLOR[facture.statut] ?? 'var(--t2)'
  const statLabel = STATUT_LABEL[facture.statut] ?? facture.statut

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Retour + actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link href="/espace-client" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Retour
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {facture.statut !== 'payee' && <PayerButton factureId={facture.id} />}
          <PrintButton />
        </div>
      </div>

      {/* Bannière confirmation paiement */}
      {paid === '1' && (
        <div className="no-print" style={{
          marginBottom: 20, padding: '12px 18px', borderRadius: 10,
          background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: 'var(--green)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
          </svg>
          Paiement reçu — votre facture sera marquée payée sous quelques instants.
        </div>
      )}

      {/* Facture */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,.25)',
      }}>
        {/* En-tête */}
        <div style={{
          padding: '32px 36px 24px',
          borderBottom: '1px solid rgba(201,168,76,.08)',
          background: 'linear-gradient(135deg,rgba(201,168,76,.04) 0%,transparent 60%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 28, fontWeight: 500, color: 'var(--gold)', letterSpacing: '.06em',
                marginBottom: 4,
              }}>
                {params2?.societe_nom ?? 'OWISE'}
              </div>
              {params2?.societe_adresse && (
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                  {params2.societe_adresse}<br/>
                  {params2.societe_code_postal} {params2.societe_ville}
                </div>
              )}
              {params2?.societe_siret && (
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                  SIRET {params2.societe_siret}
                  {params2.societe_tva_numero && ` · TVA ${params2.societe_tva_numero}`}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 16, fontWeight: 600, color: 'var(--t1)', letterSpacing: '.04em', marginBottom: 6,
              }}>
                FACTURE
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 18, fontWeight: 600, color: 'var(--gold)', marginBottom: 8,
              }}>
                {facture.numero}
              </div>
              <span style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 500,
                color: statColor,
                background: `${statColor}18`,
                border: `1px solid ${statColor}30`,
              }}>
                {statLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Bloc destinataire + dates */}
        <div style={{ padding: '24px 36px', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
                Facturé à
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
                {clientData.entreprise_nom}
              </div>
              {clientData.adresse_facturation && (
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                  {clientData.adresse_facturation}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                  Date d&apos;émission
                </div>
                <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t1)' }}>
                  {new Date(facture.date_emission).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                  Échéance
                </div>
                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13,
                  color: facture.statut !== 'payee' && new Date(facture.date_echeance) < new Date()
                    ? 'var(--red)' : 'var(--t1)',
                }}>
                  {new Date(facture.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des courses */}
        {courses.length > 0 && (
          <div style={{ padding: '24px 36px', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 90px',
              padding: '8px 0 10px',
              fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--t3)', fontWeight: 500,
              borderBottom: '1px solid rgba(201,168,76,.07)',
              marginBottom: 4,
            }}>
              <div>Date</div>
              <div>Trajet</div>
              <div style={{ textAlign: 'right' }}>Montant HT</div>
            </div>
            {courses.map((c: any) => {
              const prix = c.prix_final ?? c.prix_estime
              return (
                <div key={c.id} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 90px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
                    {new Date(c.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                      {c.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                      → {c.adresse_arrivee.split(',')[0]}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t1)' }}>
                    {prix ? `${Number(prix).toFixed(2)} €` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Totaux */}
        <div style={{ padding: '20px 36px', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
          <div style={{ maxWidth: 280, marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t2)' }}>Total HT</span>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t1)' }}>
                {Number(facture.montant_ht).toFixed(2)} €
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t2)' }}>TVA</span>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t2)' }}>
                {Number(facture.tva).toFixed(2)} €
              </span>
            </div>
            <div style={{ height: 1, background: 'rgba(201,168,76,.12)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Total TTC</span>
              <span style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 20, fontWeight: 600, color: 'var(--gold)',
              }}>
                {Number(facture.montant_ttc).toFixed(2)} €
              </span>
            </div>
          </div>
        </div>

        {/* Coordonnées bancaires + mentions */}
        <div style={{ padding: '20px 36px 28px' }}>
          {(params2?.banque_iban || params2?.banque_bic) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
                Coordonnées bancaires
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.8, fontFamily: 'var(--font-jetbrains), monospace' }}>
                {params2.banque_nom && <div>{params2.banque_nom}</div>}
                {params2.banque_iban && <div>IBAN : {params2.banque_iban}</div>}
                {params2.banque_bic && <div>BIC : {params2.banque_bic}</div>}
              </div>
            </div>
          )}
          {params2?.facture_mentions && (
            <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.7 }}>
              {params2.facture_mentions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
