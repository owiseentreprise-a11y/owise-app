'use client'

import { useState } from 'react'
import { creerFacture } from './actions'
import { lireHeureCourse } from '@/lib/heure'

type ClientOption = {
  id: string
  type_compte: string
  entreprise_nom: string | null
  profiles: { prenom: string; nom: string } | null
}

type CourseOption = {
  id: string
  client_id: string | null
  adresse_depart: string
  adresse_arrivee: string
  date_prevue: string
  prix_final: number | null
  prix_estime: number | null
}

const sel: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)', fontSize: 13,
  fontFamily: 'var(--font-dm-sans), sans-serif',
  outline: 'none', boxSizing: 'border-box',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%23848499' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)', fontSize: 13,
  fontFamily: 'var(--font-jetbrains), monospace',
  outline: 'none', boxSizing: 'border-box',
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '.14em',
  textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 6,
}

export default function NouvelleFactureForm({
  clients,
  courses,
  tauxTva,
  delaiPaiement,
}: {
  clients: ClientOption[]
  courses: CourseOption[]
  tauxTva: number
  delaiPaiement: number
}) {
  const [clientId, setClientId] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  /** Course déjà encaissée : la facture est un justificatif, pas un appel à paiement. */
  const [dejaReglee, setDejaReglee]   = useState(false)
  const [modePaiement, setModePaiement] = useState('')

  const clientCourses = courses.filter(c => c.client_id === clientId)

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function selectAll() {
    setChecked(new Set(clientCourses.map(c => c.id)))
  }

  function deselectAll() {
    setChecked(new Set())
  }

  const selectedCourses = clientCourses.filter(c => checked.has(c.id))
  const totalTTC = selectedCourses.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const totalHT = totalTTC / (1 + tauxTva / 100)

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <form action={creerFacture} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <input type="hidden" name="montant_ht" value={totalHT.toFixed(2)} />
      <input type="hidden" name="montant_ttc" value={totalTTC.toFixed(2)} />
      <input type="hidden" name="delai_paiement" value={delaiPaiement} />
      {[...checked].map(id => (
        <input key={id} type="hidden" name="course_ids[]" value={id} />
      ))}

      {/* Client */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 14, padding: '24px',
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
          color: 'var(--t2)', marginBottom: 16, paddingBottom: 12,
          borderBottom: '1px solid rgba(201,168,76,.07)',
        }}>Client à facturer</div>
        <div>
          <label style={lbl}>Client</label>
          <select
            name="client_id"
            value={clientId}
            onChange={e => { setClientId(e.target.value); setChecked(new Set()) }}
            required
            style={sel}
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map(c => {
              const nom = c.type_compte === 'entreprise'
                ? (c.entreprise_nom ?? '—')
                : `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
              return <option key={c.id} value={c.id}>{nom}</option>
            })}
          </select>
        </div>
      </div>

      {/* Courses à inclure */}
      {clientId && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px 12px',
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)' }}>
              Courses terminées non facturées
            </div>
            {clientCourses.length > 0 && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={selectAll} style={{
                  fontSize: 10, color: 'var(--gold)', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  Tout sélectionner
                </button>
                <button type="button" onClick={deselectAll} style={{
                  fontSize: 10, color: 'var(--t2)', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  Tout désélectionner
                </button>
              </div>
            )}
          </div>

          {clientCourses.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucune course terminée non facturée pour ce client
            </div>
          ) : (
            clientCourses.map(course => {
              const isChecked = checked.has(course.id)
              return (
                <label
                  key={course.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px',
                    padding: '12px 24px', alignItems: 'center', gap: 12,
                    borderBottom: '1px solid rgba(201,168,76,.04)',
                    cursor: 'pointer',
                    background: isChecked ? 'rgba(201,168,76,.04)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(course.id)}
                    style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                      {course.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                      → {course.adresse_arrivee.split(',')[0]}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {lireHeureCourse(course.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: isChecked ? 'var(--gold)' : 'var(--t1)' }}>
                      {course.prix_final != null
                        ? `${fmt(course.prix_final)} €`
                        : course.prix_estime != null ? `${fmt(course.prix_estime)} €` : '—'}
                    </div>
                    {course.prix_final == null && course.prix_estime != null && (
                      <div style={{ fontSize: 9, color: 'var(--amb)' }}>estimé</div>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      )}

      {/* Totaux + options */}
      {clientId && checked.size > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gb)',
          borderRadius: 14, padding: '24px',
        }}>
          <div style={{
            fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--t2)', marginBottom: 20, paddingBottom: 12,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>Récapitulatif</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { label: `${checked.size} course${checked.size > 1 ? 's' : ''} sélectionnée${checked.size > 1 ? 's' : ''}`, value: '' },
                  { label: 'Total HT', value: `${fmt(totalHT)} €` },
                  { label: `TVA (${tauxTva}%)`, value: `${fmt(totalTTC - totalHT)} €` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{row.label}</span>
                    {row.value && (
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, color: 'var(--t1)' }}>
                        {row.value}
                      </span>
                    )}
                  </div>
                ))}
                <div style={{ height: 1, background: 'rgba(201,168,76,.15)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Total TTC</span>
                  <span style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 22, fontWeight: 600, color: 'var(--gold)',
                  }}>
                    {fmt(totalTTC)} €
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!dejaReglee && (
                <div>
                  <label style={lbl}>Délai de paiement (jours)</label>
                  <input
                    name="delai_paiement_override"
                    type="number"
                    min={0}
                    defaultValue={delaiPaiement}
                    style={inp}
                    onChange={e => {
                      const hidden = document.querySelector('input[name="delai_paiement"]') as HTMLInputElement
                      if (hidden) hidden.value = e.target.value
                    }}
                  />
                </div>
              )}

              {/* Course réglée sur place (TPE à bord, espèces) ou déjà virée :
                  la facture sert de justificatif, pas d'appel à paiement. Sans
                  cette case, elle partait « en attente » avec un lien Stripe. */}
              <div style={{ padding: '12px 14px', borderRadius: 8,
                background: dejaReglee ? 'rgba(61,196,124,.08)' : 'rgba(0,0,0,.03)',
                border: `1px solid ${dejaReglee ? 'rgba(61,196,124,.3)' : 'var(--gb)'}` }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--t1)' }}>
                  <input type="checkbox" name="deja_reglee" checked={dejaReglee}
                    onChange={e => setDejaReglee(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>
                    <strong>Facture déjà réglée</strong>
                    <span style={{ display: 'block', color: 'var(--t2)', fontSize: 12, marginTop: 2 }}>
                      Le client a déjà payé. La facture est émise comme justificatif, sans lien de paiement.
                    </span>
                  </span>
                </label>
                {dejaReglee && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...lbl, fontSize: 11 }}>Moyen de paiement</label>
                    <select name="mode_paiement" value={modePaiement}
                      onChange={e => setModePaiement(e.target.value)} style={inp} required>
                      <option value="">Sélectionner…</option>
                      <option value="tpe_bord">Carte bancaire au TPE à bord</option>
                      <option value="especes">Espèces</option>
                      <option value="virement">Virement</option>
                      <option value="cheque">Chèque</option>
                      <option value="stripe">Paiement en ligne (Stripe)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" style={{
            marginTop: 8, padding: '13px 32px', borderRadius: 10,
            background: 'var(--gold)', border: 'none',
            color: 'var(--base)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: '0 4px 16px rgba(201,168,76,.3)',
          }}>
            Créer la facture
          </button>
        </div>
      )}
    </form>
  )
}
