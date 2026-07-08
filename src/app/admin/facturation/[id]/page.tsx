import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

import FactureActions from './FactureActions'

export const dynamic = 'force-dynamic'

const STATUT_STYLE = {
  en_attente: { color: 'var(--amb)', bg: 'rgba(232,160,48,.12)', border: 'rgba(232,160,48,.25)', label: 'En attente' },
  payee:      { color: 'var(--grn)', bg: 'rgba(61,184,122,.12)',  border: 'rgba(61,184,122,.25)',  label: 'Payée' },
  retard:     { color: 'var(--red)', bg: 'rgba(217,80,80,.12)',   border: 'rgba(217,80,80,.25)',   label: 'En retard' },
}

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  const [factureRes, coursesRes, parametresRes] = await Promise.all([
    supabase
      .from('factures')
      .select('*, clients(*, profiles(*))')
      .eq('id', id)
      .single(),
    supabase
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, prix_final, type_vehicule, nb_passagers, collaborateurs(prenom, nom)')
      .eq('facture_id', id)
      .order('date_prevue'),
    supabase.from('parametres').select('*').eq('id', true).single(),
  ])

  if (factureRes.error || !factureRes.data) notFound()

  const facture = factureRes.data
  const courses = coursesRes.data ?? []
  const p = parametresRes.data

  const client = (facture as any).clients
  const clientNom = client?.type_compte === 'entreprise'
    ? (client.entreprise_nom ?? '—')
    : client?.profiles
      ? `${client.profiles.prenom} ${client.profiles.nom}`.trim()
      : '—'
  const clientAdresse = client?.adresse_facturation ?? null

  const s = STATUT_STYLE[facture.statut as keyof typeof STATUT_STYLE]
  const tva = facture.montant_ttc - facture.montant_ht
  const tauxTva = facture.montant_ht > 0
    ? Math.round((tva / facture.montant_ht) * 100)
    : 20

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      {/* Topbar */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/admin/facturation" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Facturation
          </Link>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 13, fontWeight: 600, color: 'var(--gold)',
          }}>
            {facture.numero}
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: '4px 12px', borderRadius: 20, fontWeight: 600,
          color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        }}>
          {s.label}
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 300px',
        gap: 20, padding: '24px 32px', alignItems: 'start',
      }}>

        {/* ── Colonne principale ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* En-tête facture */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, padding: '28px',
            backgroundImage: 'radial-gradient(ellipse at 90% 0%, rgba(201,168,76,.05) 0%, transparent 60%)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              {/* Émetteur */}
              <div>
                {p?.societe_nom && (
                  <div style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 22, fontWeight: 500, color: 'var(--t1)', marginBottom: 6,
                  }}>
                    {p.societe_nom}
                  </div>
                )}
                {p?.societe_adresse && (
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                    {p.societe_adresse}<br />
                    {p.societe_code_postal} {p.societe_ville}
                  </div>
                )}
                {p?.societe_siret && (
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4, fontFamily: 'var(--font-jetbrains), monospace' }}>
                    SIRET {p.societe_siret}
                  </div>
                )}
                {p?.societe_tva_numero && (
                  <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    TVA {p.societe_tva_numero}
                  </div>
                )}
              </div>

              {/* Numéro + dates */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 20, fontWeight: 600, color: 'var(--gold)', marginBottom: 8,
                }}>
                  {facture.numero}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--t3)' }}>Émise le </span>
                  {fmtDate(facture.date_emission)}<br />
                  {facture.date_echeance && (
                    <>
                      <span style={{ color: 'var(--t3)' }}>Échéance </span>
                      {fmtDate(facture.date_echeance)}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Destinataire */}
            <div style={{
              padding: '16px 20px', borderRadius: 10,
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              display: 'inline-block', minWidth: 260,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                Facturé à
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{clientNom}</div>
              {clientAdresse && (
                <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>{clientAdresse}</div>
              )}
            </div>
          </div>

          {/* Courses incluses */}
          {courses.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 60px 90px',
                padding: '10px 20px',
                fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--t3)', borderBottom: '1px solid rgba(201,168,76,.07)',
              }}>
                <div>Trajet</div>
                <div>Date</div>
                <div>Pax</div>
                <div style={{ textAlign: 'right' }}>Montant</div>
              </div>
              {courses.map((course: any) => {
                const collab = course.collaborateurs
                const collabNom = collab
                  ? `${collab.prenom ?? ''} ${collab.nom ?? ''}`.trim() || null
                  : null
                return (
                  <div key={course.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 60px 90px',
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(201,168,76,.04)',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                        {course.adresse_depart.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                        → {course.adresse_arrivee.split(',')[0]}
                      </div>
                      {collabNom && (
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>↳ {collabNom}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {new Date(course.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {course.nb_passagers}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t1)' }}>
                      {course.prix_final != null ? `${fmt(course.prix_final)} €` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Totaux */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300, marginLeft: 'auto' }}>
              {[
                { label: 'Total HT', value: `${fmt(facture.montant_ht)} €`, main: false },
                { label: `TVA (${tauxTva}%)`, value: `${fmt(tva)} €`, main: false },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t1)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(201,168,76,.12)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Total TTC</span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 22, fontWeight: 600, color: 'var(--gold)',
                }}>
                  {fmt(facture.montant_ttc)} €
                </span>
              </div>
            </div>
          </div>

          {/* Mentions légales */}
          {p?.facture_mentions && (
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              border: '1px solid var(--t3)',
              fontSize: 10, color: 'var(--t3)', lineHeight: 1.7,
            }}>
              {p.facture_mentions}
            </div>
          )}

          {/* Coordonnées bancaires */}
          {(p?.banque_iban || p?.banque_bic) && (
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: 'var(--surface)', border: '1px solid var(--gb)',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
                Règlement par virement
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.banque_nom && <div style={{ fontSize: 11, color: 'var(--t2)' }}>{p.banque_nom}</div>}
                {p.banque_iban && (
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t1)', letterSpacing: '.06em' }}>
                    IBAN : {p.banque_iban}
                  </div>
                )}
                {p.banque_bic && (
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: 'var(--t2)' }}>
                    BIC : {p.banque_bic}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Statut + actions */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
              Statut du paiement
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 8,
              background: s.bg, border: `1px solid ${s.border}`,
              marginBottom: 16,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
            </div>
            <FactureActions
              factureId={facture.id}
              statut={facture.statut as any}
              stripePaymentLink={(facture as any).stripe_payment_link ?? null}
            />
          </div>

          {/* Récap financier */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
              Récapitulatif
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>Courses incluses</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t1)' }}>
                  {courses.length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>Montant HT</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t1)' }}>
                  {fmt(facture.montant_ht)} €
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>TVA</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t1)' }}>
                  {fmt(tva)} €
                </span>
              </div>
              <div style={{ height: 1, background: 'rgba(201,168,76,.1)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>TTC</span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 18, fontWeight: 600, color: 'var(--gold)',
                }}>
                  {fmt(facture.montant_ttc)} €
                </span>
              </div>
            </div>
          </div>

          {/* Client */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 12 }}>
              Client
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 4 }}>{clientNom}</div>
            {clientAdresse && (
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>{clientAdresse}</div>
            )}
            {client?.profiles?.telephone && (
              <a href={`tel:${client.profiles.telephone}`} style={{
                display: 'block', marginTop: 6,
                fontSize: 11, color: 'var(--gold)', textDecoration: 'none',
              }}>
                {client.profiles.telephone}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
