import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { modifierSousTraitantAction, genererFactureSTAction, marquerFactureSTPayeeAction, creerCompteSTAction, supprimerCompteSTAction } from '../actions'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SousTraitantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = createAdminClient()

  const [stRes, coursesRes, facturesRes, chauffeursRes] = await Promise.all([
    supabase.from('sous_traitants').select('*').eq('id', id).single(),
    supabase.from('courses')
      .select('id, statut, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_sous_traitant, facture_st_id, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
      .eq('sous_traitant_id', id)
      .order('date_prevue', { ascending: false })
      .limit(50),
    supabase.from('factures_sous_traitants')
      .select('*')
      .eq('sous_traitant_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('chauffeurs')
      .select('id, statut, vehicule_marque, vehicule_modele, vehicule_immatriculation, type_vehicule, profiles(prenom, nom, telephone)')
      .eq('sous_traitant_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!stRes.data) notFound()
  const st        = stRes.data
  const courses   = coursesRes.data ?? []
  const factures  = facturesRes.data ?? []
  const chauffeurs = chauffeursRes.data ?? []

  const inputStyle = {
    background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
    borderRadius: 9, padding: '11px 14px',
    color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' as const,
    color: 'var(--t2)', fontWeight: 500, display: 'block', marginBottom: 6,
  }

  const terminees = courses.filter(c => c.statut === 'terminee')
  const nbTerminees = terminees.length
  const totalCA   = terminees.reduce((s, c) => s + ((c as any).prix_final ?? 0), 0)
  const totalCout = terminees.reduce((s, c) => s + ((c as any).prix_sous_traitant ?? 0), 0)
  const totalMarge = totalCA - totalCout

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin/sous-traitants" style={{ color: 'var(--t3)', textDecoration: 'none', fontSize: 13 }}>
            ← Sous-traitants
          </a>
          <span style={{ color: 'var(--t3)' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--t1)' }}>{st.nom}</span>
        </div>
        <span style={{
          fontSize: 9, padding: '3px 10px', borderRadius: 4, fontWeight: 500,
          color:      st.actif ? 'var(--grn)' : 'var(--t3)',
          background: st.actif ? 'rgba(61,184,122,.1)' : 'var(--elevated)',
          border:     st.actif ? '1px solid rgba(61,184,122,.2)' : '1px solid var(--t3)',
        }}>
          {st.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Banners */}
        {sp.success === '1' && (
          <div style={{
            background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)',
            borderRadius: 9, padding: '11px 14px', fontSize: 13, color: 'var(--grn)',
          }}>
            ✓ Modifications enregistrées.
          </div>
        )}
        {sp.error && (
          <div style={{
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.25)',
            borderRadius: 9, padding: '12px 16px', fontSize: 13, color: '#e88080',
            lineHeight: 1.6,
          }}>
            {sp.error === 'compte-existant' || sp.error === 'email-deja-utilise' ? (
              <>
                <strong>Email déjà utilisé par un autre compte.</strong><br/>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  Si c'est un auto-entrepreneur avec la même adresse, utilisez une variante :<br/>
                  • Gmail : ajoutez <code style={{ background: 'var(--elevated)', padding: '1px 5px', borderRadius: 4 }}>+st</code> → <em>jean.dupont+st@gmail.com</em> (même boîte, email différent)<br/>
                  • Autre : créez une adresse pro dédiée (ex: <em>vtc@societe.fr</em>)
                </span>
              </>
            ) : sp.error === 'email-autre-st' ? (
              <>
                <strong>Cet email est déjà lié à un autre sous-traitant.</strong><br/>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>Utilisez un email différent.</span>
              </>
            ) : sp.error === 'champs-requis' ? (
              'Email et mot de passe requis.'
            ) : (
              'Erreur lors de la mise à jour. Réessayez.'
            )}
          </div>
        )}
        {sp.success === 'compte-cree' && (
          <div style={{
            background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)',
            borderRadius: 9, padding: '11px 14px', fontSize: 13, color: 'var(--grn)',
          }}>
            ✓ Compte de connexion créé. Le sous-traitant peut se connecter sur owise.fr/sous-traitant-login
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Courses totales', value: courses.length, mono: true },
            { label: 'Courses terminées', value: nbTerminees, mono: true },
            { label: 'CA client', value: totalCA > 0 ? `${totalCA.toFixed(2)} €` : '—', mono: true, gold: true },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                {k.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 22, fontWeight: 600,
                color: k.gold ? 'var(--gold)' : 'var(--t1)',
              }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* KPIs financiers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Coût sous-traitant', value: totalCout > 0 ? `${totalCout.toFixed(2)} €` : '—', color: 'var(--red)' },
            { label: 'Marge Owise', value: totalCout > 0 ? `${totalMarge.toFixed(2)} €` : '—', color: totalMarge >= 0 ? 'var(--grn)' : 'var(--red)' },
            { label: 'Taux de marge', value: totalCA > 0 && totalCout > 0 ? `${((totalMarge / totalCA) * 100).toFixed(1)} %` : '—', color: 'var(--blu)' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                {k.label}
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 22, fontWeight: 600, color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── ACCÈS PORTAL ── */}
        {(() => {
          const userId = (st as any).user_id as string | null
          const hasAccount = !!userId
          const errorMsg = sp.error === 'compte-existant' ? 'Un compte existe déjà avec cet email.'
            : sp.error === 'champs-requis' ? 'Email et mot de passe requis.' : null
          const successMsg = sp.success === 'compte-cree' ? 'Compte créé avec succès.' : null

          return (
            <div style={{
              background: 'var(--surface)', border: `1px solid ${hasAccount ? 'rgba(61,184,122,.25)' : 'rgba(201,168,76,.15)'}`,
              borderRadius: 14, padding: '20px 24px', marginBottom: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Accès portal sous-traitant</div>
                  <span style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                    color: hasAccount ? 'var(--grn)' : 'var(--amb)',
                    background: hasAccount ? 'rgba(61,184,122,.1)' : 'rgba(232,160,48,.1)',
                    border: hasAccount ? '1px solid rgba(61,184,122,.25)' : '1px solid rgba(232,160,48,.2)',
                  }}>
                    {hasAccount ? '● Compte actif' : '○ Pas de compte'}
                  </span>
                </div>
                {hasAccount && (
                  <a href="/sous-traitant" target="_blank" style={{
                    fontSize: 10, color: 'var(--grn)', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    Voir le portal ↗
                  </a>
                )}
              </div>

              {successMsg && (
                <div style={{ background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'var(--grn)' }}>
                  ✓ {successMsg}
                </div>
              )}
              {errorMsg && (
                <div style={{ background: 'rgba(217,84,84,.1)', border: '1px solid rgba(217,84,84,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'var(--red)' }}>
                  {errorMsg}
                </div>
              )}

              {!hasAccount ? (
                <form action={creerCompteSTAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="hidden" name="sous_traitant_id" value={st.id} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 5 }}>Email</label>
                      <input type="email" name="email" required defaultValue={st.email ?? ''} placeholder="contact@vtc.fr"
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--t3)', borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 5 }}>Mot de passe</label>
                      <input type="password" name="password" required placeholder="8 caractères min."
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--elevated)', border: '1px solid var(--t3)', borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                  <button type="submit" style={{
                    alignSelf: 'flex-start', padding: '9px 18px', borderRadius: 8,
                    background: 'var(--gold)', border: 'none',
                    color: 'var(--base)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}>
                    Créer le compte portal
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                    Le sous-traitant peut se connecter sur <strong style={{ color: 'var(--t1)' }}>owise.fr/sous-traitant-login</strong>
                  </div>
                  <form action={supprimerCompteSTAction}>
                    <input type="hidden" name="sous_traitant_id" value={st.id} />
                    <input type="hidden" name="user_id" value={userId} />
                    <button type="submit" style={{
                      padding: '6px 12px', borderRadius: 7, fontSize: 10,
                      background: 'transparent', border: '1px solid rgba(217,84,84,.3)',
                      color: 'var(--red)', cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}>
                      Supprimer l'accès
                    </button>
                  </form>
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* Formulaire édition */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 18 }}>Informations</div>
            <form action={modifierSousTraitantAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="hidden" name="id" value={st.id} />

              <div>
                <label style={labelStyle}>Société *</label>
                <input name="nom" type="text" required defaultValue={st.nom} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contact</label>
                  <input name="contact_nom" type="text" defaultValue={st.contact_nom ?? ''} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input name="telephone" type="tel" defaultValue={st.telephone ?? ''} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input name="email" type="email" defaultValue={st.email ?? ''} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>SIRET</label>
                  <input name="siret" type="text" defaultValue={st.siret ?? ''} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Adresse</label>
                <input name="adresse" type="text" defaultValue={st.adresse ?? ''} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Mode de paiement</label>
                <select name="mode_paiement" defaultValue={(st as any).mode_paiement ?? 'mensuel'} style={inputStyle}>
                  <option value="immediat">Immédiat — à la fin de chaque course</option>
                  <option value="hebdomadaire">Hebdomadaire — fin de semaine</option>
                  <option value="mensuel">Mensuel — fin de mois</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Notes internes</label>
                <textarea name="notes" rows={3} defaultValue={st.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </div>

              <div>
                <label style={labelStyle}>Statut</label>
                <select name="actif" defaultValue={st.actif ? 'true' : 'false'} style={inputStyle}>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </div>

              <button type="submit" style={{
                background: 'var(--gold)', color: 'var(--base)', border: 'none',
                borderRadius: 9, padding: '11px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                marginTop: 4,
              }}>
                Enregistrer
              </button>
            </form>
          </div>

          {/* Courses associées */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Courses sous-traitées</span>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                {courses.length}
              </span>
            </div>

            {courses.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Aucune course assignée
              </div>
            ) : courses.map((c, i) => {
              const client = (c as any).clients
              const clientNom = client?.type_compte === 'entreprise'
                ? (client.entreprise_nom ?? '—')
                : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : '—'
              const color = STATUT_COURSE_COLOR[c.statut as keyof typeof STATUT_COURSE_COLOR]
              const label = STATUT_COURSE_LABEL[c.statut as keyof typeof STATUT_COURSE_LABEL]
              return (
                <a
                  key={c.id}
                  href={`/admin/courses/${c.id}`}
                  style={{
                    display: 'block', padding: '12px 20px', textDecoration: 'none',
                    borderBottom: i < courses.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                        {c.adresse_depart.split(',')[0]}
                        <span style={{ color: 'var(--t3)', margin: '0 6px' }}>→</span>
                        {c.adresse_arrivee.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                        {new Date(c.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {' · '}{clientNom}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {c.prix_final && (
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--gold)' }}>
                          {c.prix_final} €
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        color, background: `${color}18`, border: `1px solid ${color}30`,
                      }}>
                        {label}
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* ── CHAUFFEURS RATTACHÉS ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid rgba(201,168,76,.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Chauffeurs rattachés</span>
              <span style={{
                fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10,
                color: 'var(--t3)', background: 'var(--elevated)',
                border: '1px solid var(--gb)', borderRadius: 5, padding: '1px 7px',
              }}>{chauffeurs.length}</span>
            </div>
            <a href={`/admin/chauffeurs/nouveau`} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7,
              background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
              color: 'var(--gold)', fontSize: 11, fontWeight: 500, textDecoration: 'none',
            }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Ajouter un chauffeur
            </a>
          </div>

          {chauffeurs.length === 0 ? (
            <div style={{ padding: '28px 24px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              Aucun chauffeur rattaché à cette société.<br/>
              <span style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                Créez un chauffeur avec type "Sous-traitant" et sélectionnez {st.nom}.
              </span>
            </div>
          ) : (
            <div>
              {(chauffeurs as any[]).map((c, i) => {
                const nom = c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'
                const tel = c.profiles?.telephone ?? null
                const veh = [c.vehicule_marque, c.vehicule_modele].filter(Boolean).join(' ')
                const immat = c.vehicule_immatriculation ?? null
                const isDisponible = c.statut === 'disponible'
                return (
                  <a
                    key={c.id}
                    href={`/admin/chauffeurs/${c.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 24px', textDecoration: 'none',
                      borderBottom: i < chauffeurs.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--elevated)', border: '1px solid var(--t3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 600, color: 'var(--t2)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}>
                        {nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>{nom}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {veh && <span style={{ fontSize: 10, color: 'var(--t2)' }}>{veh}</span>}
                          {immat && (
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-jetbrains), monospace',
                              color: 'var(--t3)', background: 'var(--elevated)',
                              border: '1px solid var(--t3)', borderRadius: 4, padding: '1px 6px',
                            }}>{immat}</span>
                          )}
                          {tel && <span style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-jetbrains), monospace' }}>{tel}</span>}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                      color: isDisponible ? 'var(--grn)' : 'var(--t3)',
                      background: isDisponible ? 'rgba(61,184,122,.1)' : 'var(--elevated)',
                      border: isDisponible ? '1px solid rgba(61,184,122,.2)' : '1px solid var(--t3)',
                    }}>
                      {isDisponible ? 'Disponible' : c.statut === 'en_course' ? 'En course' : 'Hors ligne'}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FACTURATION SORTANTE ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '24px' }}>
        {(() => {
          const mode = (st as any).mode_paiement ?? 'mensuel'
          const modeLabel = mode === 'immediat' ? 'Immédiat (auto)' : mode === 'hebdomadaire' ? 'Hebdomadaire' : 'Mensuel'
          const btnLabel = mode === 'hebdomadaire' ? '+ Générer facture semaine' : '+ Générer facture du mois'
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Facturation sortante</div>
                <span style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                  color: mode === 'immediat' ? 'var(--grn)' : mode === 'hebdomadaire' ? 'var(--blu)' : 'var(--gold)',
                  background: mode === 'immediat' ? 'rgba(61,184,122,.1)' : mode === 'hebdomadaire' ? 'rgba(77,142,212,.1)' : 'rgba(201,168,76,.1)',
                  border: mode === 'immediat' ? '1px solid rgba(61,184,122,.25)' : mode === 'hebdomadaire' ? '1px solid rgba(77,142,212,.25)' : '1px solid rgba(201,168,76,.25)',
                }}>
                  {modeLabel}
                </span>
              </div>
              {mode !== 'immediat' && (
                <form action={genererFactureSTAction}>
                  <input type="hidden" name="sous_traitant_id" value={st.id} />
                  <input type="hidden" name="mode_paiement" value={mode} />
                  <button type="submit" style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'var(--gold)', border: 'none',
                    color: 'var(--base)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}>
                    {btnLabel}
                  </button>
                </form>
              )}
              {mode === 'immediat' && (
                <span style={{ fontSize: 10, color: 'var(--t3)', fontStyle: 'italic' }}>
                  Factures créées automatiquement à la fin de chaque course
                </span>
              )}
            </div>
          )
        })()}

        {factures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: 12 }}>
            Aucune facture générée
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {factures.map((f: any) => {
              const coursesDeLaFacture = courses.filter((c: any) => (c as any).facture_st_id === f.id)
              return (
                <div key={f.id} style={{
                  background: 'var(--elevated)', borderRadius: 10,
                  border: `1px solid ${f.statut === 'payee' ? 'rgba(61,184,122,.2)' : 'rgba(232,160,48,.2)'}`,
                  overflow: 'hidden',
                }}>
                  {/* En-tête facture */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center', gap: 16,
                    padding: '12px 16px',
                    borderBottom: coursesDeLaFacture.length > 0 ? '1px solid rgba(201,168,76,.07)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>
                        {f.periode}
                      </div>
                      {f.notes && <div style={{ fontSize: 10, color: 'var(--t3)' }}>{f.notes}</div>}
                      {f.date_paiement && (
                        <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: 2 }}>
                          Payée le {new Date(f.date_paiement).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
                      {Number(f.montant_ht).toFixed(2)} €
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, padding: '3px 9px', borderRadius: 4, fontWeight: 600,
                        color:      f.statut === 'payee' ? 'var(--grn)' : 'var(--amb)',
                        background: f.statut === 'payee' ? 'rgba(61,184,122,.1)' : 'rgba(232,160,48,.1)',
                        border:     f.statut === 'payee' ? '1px solid rgba(61,184,122,.25)' : '1px solid rgba(232,160,48,.25)',
                      }}>
                        {f.statut === 'payee' ? 'Payée' : 'En attente'}
                      </span>
                      {f.statut === 'en_attente' && (
                        <form action={marquerFactureSTPayeeAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="facture_id" value={f.id} />
                          <input type="hidden" name="sous_traitant_id" value={st.id} />
                          <button type="submit" style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500,
                            background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)',
                            color: 'var(--grn)', cursor: 'pointer',
                            fontFamily: 'var(--font-dm-sans), sans-serif',
                          }}>
                            Marquer payée
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Détail des courses */}
                  {coursesDeLaFacture.length > 0 && (
                    <div>
                      {coursesDeLaFacture.map((c: any, ci: number) => (
                        <a
                          key={c.id}
                          href={`/admin/courses/${c.id}`}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr auto auto',
                            alignItems: 'center', gap: 12,
                            padding: '9px 16px 9px 24px', textDecoration: 'none',
                            borderBottom: ci < coursesDeLaFacture.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                            background: 'rgba(0,0,0,.06)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--t1)', fontWeight: 500 }}>
                              {c.adresse_depart.split(',')[0]}
                              <span style={{ color: 'var(--t3)', margin: '0 5px' }}>→</span>
                              {c.adresse_arrivee.split(',')[0]}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1, fontFamily: 'var(--font-jetbrains), monospace' }}>
                              {new Date(c.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              {' · '}
                              {new Date(c.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--t2)' }}>
                            {c.prix_sous_traitant != null ? `${Number(c.prix_sous_traitant).toFixed(0)} €` : '—'}
                          </div>
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="var(--t3)" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      </div>
    </>
  )
}
