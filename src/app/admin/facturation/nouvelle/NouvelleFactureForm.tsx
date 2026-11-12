'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  /* Lignes saisies a la main, pour une prestation qui n'a aucune course
     enregistree — reservee par telephone, par exemple. Elles ne coexistent
     jamais avec des courses cochees : l'action le refuse, et l'ecran ne les
     propose que lorsque aucune course n'est selectionnee. */
  const [lignes, setLignes] = useState<{ libelle: string; montant: string }[]>([])
  const ajouterLigne  = () => setLignes(l => [...l, { libelle: '', montant: '' }])
  const retirerLigne  = (i: number) => setLignes(l => l.filter((_, j) => j !== i))
  const majLigne = (i: number, champ: 'libelle' | 'montant', v: string) =>
    setLignes(l => l.map((x, j) => (j === i ? { ...x, [champ]: v } : x)))

  /* LES COURSES SANS CLIENT RATTACHÉ SONT PROPOSÉES AUSSI.

     Cet écran ne montrait que les courses du client choisi. Or 8 courses
     terminées, pour 782 €, ne portaient aucun client — elles avaient été
     saisies à la main sans en choisir un. Elles étaient donc invisibles
     ici, quel que soit le client : impossible d'en faire une facture
     depuis l'application. Constaté en base le 2026-11-09.

     Elles sont maintenant offertes avec celles du client, signalées d'une
     pastille, et rattachées au client choisi au moment de la facturation
     — voir `creerFacture`. Une course facturée à quelqu'un appartient à
     ce quelquun : la fois suivante, elle apparaîtra normalement. */
  const coursesDuClient = courses.filter(c => c.client_id === clientId)
  const coursesSansClient = courses.filter(c => c.client_id === null)
  const clientCourses = [...coursesDuClient, ...coursesSansClient]
    .sort((a, b) => String(a.date_prevue).localeCompare(String(b.date_prevue)))

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
  const lignesValides = lignes.filter(l => l.libelle.trim() && Number(l.montant) > 0)
  const totalLignes = Math.round(lignesValides.reduce((s, l) => s + Number(l.montant), 0) * 100) / 100
  const totalCourses = selectedCourses.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const totalTTC = lignesValides.length > 0 ? totalLignes : totalCourses
  const totalHT = totalTTC / (1 + tauxTva / 100)
  const peutCreer = selectedCourses.length > 0 || lignesValides.length > 0

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <form action={creerFacture} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <input type="hidden" name="montant_ht" value={totalHT.toFixed(2)} />
      <input type="hidden" name="montant_ttc" value={totalTTC.toFixed(2)} />
      <input type="hidden" name="delai_paiement" value={delaiPaiement} />
      {[...checked].map(id => (
        <input key={id} type="hidden" name="course_ids[]" value={id} />
      ))}
      {/* Les lignes saisies. Seules les lignes completes partent : une ligne
          vide laissee a l'ecran ne doit pas arriver au serveur. */}
      {lignesValides.map((l, i) => (
        <span key={i}>
          <input type="hidden" name="ligne_libelle[]" value={l.libelle.trim()} />
          <input type="hidden" name="ligne_montant[]" value={String(Number(l.montant))} />
        </span>
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
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)' }}>
                Courses terminées non facturées
              </div>
              {coursesSansClient.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>
                  dont {coursesSansClient.length} sans client enregistré, que cette facture rattachera
                </div>
              )}
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
            /* Dire ce qu'il faut faire, pas seulement qu'il n'y a rien.
               Constat du 2026-11-09 : une cliente avait réservé par téléphone,
               la course n'était pas enregistrée, et cet écran se contentait de
               « aucune course » — sans indiquer que le chemin existe. Une
               facture à envoyer le jour même restait bloquée faute d'un lien. */
            <div style={{ padding: '28px 32px', textAlign: 'center', fontSize: 13 }}>
              <div style={{ color: 'var(--t3)', marginBottom: 10 }}>
                Aucune course terminée non facturée pour ce client
              </div>
              <div style={{ color: 'var(--t2)', fontSize: 12, lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
                La course a été réservée par téléphone et n’a pas été saisie ?
                Enregistrez-la avec sa <strong>date réelle</strong> : la case
                «&nbsp;Course déjà effectuée&nbsp;» apparaît dès que la date est
                passée, la course est créée comme terminée, et elle revient ici
                aussitôt.
              </div>
              <Link
                href="/admin/courses/nouvelle"
                style={{
                  display: 'inline-block', marginTop: 14, padding: '9px 18px',
                  borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: 'var(--gm)', border: '1px solid var(--gb)',
                  color: 'var(--gold)', textDecoration: 'none',
                }}
              >
                Enregistrer une course déjà effectuée
              </Link>

              {/* ── Ou saisir la prestation directement ──────────────────
                  Pour une prestation qui n'a pas vocation à devenir une
                  course — un forfait à la journée, une mise à disposition,
                  une prestation déjà facturée hors système. On saisit comme
                  sur un devis : une désignation, un montant. */}
              <div style={{
                marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--gb)', textAlign: 'left',
              }}>
                <div style={{
                  fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
                  color: 'var(--t2)', fontWeight: 500, marginBottom: 4,
                }}>
                  Ou saisir la prestation à la main
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 14, lineHeight: 1.6 }}>
                  Une désignation et un montant par ligne, comme sur un devis.
                  Elles apparaîtront telles quelles sur la facture.
                </div>

                {lignes.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      value={l.libelle}
                      onChange={e => majLigne(i, 'libelle', e.target.value)}
                      placeholder="Transfert Senlis → CDG, le 7 novembre"
                      style={{
                        flex: 1, background: 'var(--elevated)', border: '1px solid var(--t3)',
                        borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--t1)',
                        outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}
                    />
                    <input
                      value={l.montant}
                      onChange={e => majLigne(i, 'montant', e.target.value.replace(',', '.'))}
                      inputMode="decimal"
                      placeholder="59"
                      style={{
                        width: 96, background: 'var(--elevated)', border: '1px solid var(--t3)',
                        borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: 'var(--t1)',
                        outline: 'none', textAlign: 'right',
                        fontFamily: 'var(--font-jetbrains), monospace',
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>€</span>
                    <button
                      type="button"
                      onClick={() => retirerLigne(i)}
                      title="Retirer cette ligne"
                      style={{
                        background: 'transparent', border: '1px solid var(--t3)', borderRadius: 8,
                        color: 'var(--t2)', cursor: 'pointer', padding: '7px 11px', fontSize: 13,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={ajouterLigne}
                  style={{
                    marginTop: 4, padding: '8px 15px', borderRadius: 8, fontSize: 12,
                    background: 'transparent', border: '1px dashed var(--gb)',
                    color: 'var(--gold)', cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                >
                  + Ajouter une ligne
                </button>

                {lignesValides.length > 0 && (
                  <div style={{
                    marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--gb)',
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, color: 'var(--t1)',
                  }}>
                    <span>Total de la facture</span>
                    <b style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--gold)' }}>
                      {fmt(totalLignes)} €
                    </b>
                  </div>
                )}
              </div>
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
                    {course.client_id === null && (
                      <div style={{
                        marginTop: 3, display: 'inline-block',
                        fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase',
                        color: 'var(--amb)', background: 'rgba(232,160,48,.10)',
                        border: '1px solid rgba(232,160,48,.22)',
                        borderRadius: 5, padding: '2px 7px',
                      }}>
                        sans client — sera rattachée
                      </div>
                    )}
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
      {clientId && peutCreer && (
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
                background: dejaReglee ? 'rgba(61,196,124,.08)' : 'rgba(201,168,76,.12)',
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
