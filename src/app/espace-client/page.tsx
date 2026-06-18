import { createClient } from '@/lib/supabase/server'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'
import DemanderCourseClient from './DemanderCourseClient'
import CollaborateursManager from './CollaborateursManager'
import NotationCourse from './NotationCourse'
import ClientRealtime from './ClientRealtime'
import ParrainageWidget from './ParrainageWidget'
import CourseActionsClient from './CourseActionsClient'
import { getOrCreateParrainageCode, getParrainageStats } from './actions-parrainage'

export const dynamic = 'force-dynamic'

const STATUT_FACTURE_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  payee:      'Payée',
  retard:     'En retard',
}
const STATUT_FACTURE_COLOR: Record<string, string> = {
  en_attente: 'var(--amb)',
  payee:      'var(--grn)',
  retard:     'var(--red)',
}

export default async function EspaceClientPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const sp = await searchParams
  const success = sp.success === 'demande-envoyee'
  const error = sp.error === 'champs-manquants'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const isCollab = user.app_metadata?.role === 'collaborateur'

  // Vérifie le type de compte (seulement si pas collab)
  let isEntreprise    = false
  let peutPayerAbord  = false
  if (!isCollab) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('type_compte, payer_a_bord')
      .eq('id', user.id)
      .single()
    isEntreprise   = clientData?.type_compte === 'entreprise'
    peutPayerAbord = clientData?.payer_a_bord === true
  } else {
    // Collaborateur → facturation entreprise
    isEntreprise = true
  }

  // Modes de paiement autorisés (config globale admin)
  const { data: paramsData } = await supabase
    .from('parametres')
    .select('paiement_stripe_actif, paiement_cash_actif, paiement_cheque_actif, paiement_virement_actif')
    .eq('id', true)
    .single()
  const modesActifs = {
    stripe:   paramsData?.paiement_stripe_actif   ?? true,
    cash:     (paramsData?.paiement_cash_actif     ?? false) && peutPayerAbord,
    cheque:   paramsData?.paiement_cheque_actif   ?? false,
    virement: paramsData?.paiement_virement_actif ?? false,
  }

  // Courses : collaborateur → ses propres courses ; client classique → ses courses
  const baseQuery = supabase
    .from('courses')
    .select('id, statut, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, note_client, chauffeur_id, chauffeurs(profiles(prenom, nom))')
    .order('date_prevue', { ascending: false })
    .limit(50)

  const query = isCollab
    ? baseQuery.eq('collaborateur_id', user.id)
    : baseQuery.eq('client_id', user.id)

  // Factures — uniquement clients entreprise, jamais collaborateurs
  const facturesQuery = isEntreprise && !isCollab
    ? supabase
        .from('factures')
        .select('id, numero, date_emission, date_echeance, montant_ht, tva, montant_ttc, statut')
        .eq('client_id', user.id)
        .order('date_emission', { ascending: false })
        .limit(20)
    : null

  // Collaborateurs — uniquement pour les comptes entreprise (non-collab)
  const collabsQuery = isEntreprise && !isCollab
    ? supabase
        .from('collaborateurs')
        .select('id, nom, prenom, tel, email, poste, adresse')
        .eq('client_id', user.id)
        .order('created_at', { ascending: true })
    : null

  const [coursesRes, facturesRes, collabsRes] = await Promise.all([
    query,
    facturesQuery ?? Promise.resolve({ data: null }),
    collabsQuery  ?? Promise.resolve({ data: null }),
  ])

  const list = coursesRes.data ?? []
  const factures = (facturesRes.data ?? []) as any[]
  const collaborateurs = (collabsRes.data ?? []) as any[]

  const enCours   = list.filter(c => ['acceptee', 'en_route', 'prise_en_charge'].includes(c.statut))
  const enAttente = list.filter(c => c.statut === 'en_attente')
  const historique = list.filter(c => ['terminee', 'annulee'].includes(c.statut))

  // Parrainage — créer le code si nécessaire + stats
  const [parrainageCode, parrainageStats] = await Promise.all([
    getOrCreateParrainageCode(),
    getParrainageStats(),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <ClientRealtime userId={user.id} />

      {/* Demande de course */}
      <DemanderCourseClient
        success={success} error={error}
        isEntreprise={isEntreprise}
        peutPayerAbord={peutPayerAbord}
        modesActifs={modesActifs}
        collaborateurs={isEntreprise && !isCollab ? collaborateurs : []}
      />

      {/* Courses en cours */}
      {enCours.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 12 }}>
            En cours
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enCours.map(c => <CourseCard key={c.id} course={c} highlight />)}
          </div>
        </div>
      )}

      {/* Réservations en attente — modifiables/annulables */}
      {enAttente.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--amb)', fontWeight: 500, marginBottom: 12 }}>
            En attente de confirmation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enAttente.map(c => <CourseCard key={c.id} course={c} highlight />)}
          </div>
        </div>
      )}

      {/* Historique */}
      <div>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 12 }}>
          Historique
        </div>
        {historique.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '32px', textAlign: 'center',
            fontSize: 13, color: 'var(--t3)',
          }}>
            Aucune course pour le moment
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historique.map(c => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </div>

      {/* Mon équipe — uniquement pour les comptes entreprise (pas les collabs) */}
      {isEntreprise && !isCollab && (
        <CollaborateursManager collaborateurs={collaborateurs} />
      )}

      {/* Programme de parrainage — tous les clients */}
      {!isCollab && (
        <ParrainageWidget
          code={parrainageStats.code ?? parrainageCode.code}
          nbFilleuls={parrainageStats.nbFilleuls}
          credits={parrainageStats.credits}
          totalDispo={parrainageStats.totalDispo}
        />
      )}

      {/* Factures — uniquement clients entreprise, jamais collaborateurs */}
      {isEntreprise && !isCollab && (
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 12 }}>
            Mes factures
          </div>
          {factures.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '32px', textAlign: 'center',
              fontSize: 13, color: 'var(--t3)',
            }}>
              Aucune facture disponible
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {/* En-tête tableau */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 140px 100px 110px',
                padding: '10px 20px',
                fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--t3)', fontWeight: 500,
                borderBottom: '1px solid rgba(201,168,76,.07)',
              }}>
                <div>Référence</div>
                <div>Émission</div>
                <div>Échéance</div>
                <div style={{ textAlign: 'right' }}>Montant TTC</div>
                <div style={{ textAlign: 'right' }}>Statut</div>
              </div>
              {factures.map((f: any, i: number) => {
                const statColor = STATUT_FACTURE_COLOR[f.statut] ?? 'var(--t2)'
                const statLabel = STATUT_FACTURE_LABEL[f.statut] ?? f.statut
                const echeanceDate = new Date(f.date_echeance)
                const isLate = f.statut === 'retard' || (f.statut === 'en_attente' && echeanceDate < new Date())
                return (
                  <a
                    key={f.id}
                    href={`/espace-client/factures/${f.id}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 140px 100px 110px',
                      padding: '13px 20px',
                      borderBottom: i < factures.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                      alignItems: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                        {f.numero}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {new Date(f.date_emission).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, color: isLate ? 'var(--red)' : 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {echeanceDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {isLate && f.statut !== 'payee' && (
                        <span style={{ fontSize: 9, color: 'var(--red)', marginLeft: 6 }}>
                          +{Math.ceil((new Date().getTime() - echeanceDate.getTime()) / 86400000)}j
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                      {Number(f.montant_ttc).toFixed(2)} €
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 9.5, padding: '3px 9px', borderRadius: 20, fontWeight: 500,
                        color: statColor,
                        background: `${statColor}18`,
                        border: `1px solid ${statColor}30`,
                      }}>
                        {statLabel}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CourseCard({ course, highlight = false }: { course: any; highlight?: boolean }) {
  const date = new Date(course.date_prevue)
  const chauffeur = course.chauffeurs
  const chauffeurNom = chauffeur?.profiles
    ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
    : null
  const color = STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR]
  const label = STATUT_COURSE_LABEL[course.statut as keyof typeof STATUT_COURSE_LABEL]
  const peutNoter = course.statut === 'terminee' && course.chauffeur_id && !course.note_client

  return (
    <div style={{
      background: highlight ? 'rgba(201,168,76,.04)' : 'var(--surface)',
      border: `1px solid ${highlight ? 'rgba(201,168,76,.15)' : 'var(--gb)'}`,
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
              color, background: `${color}18`, border: `1px solid ${color}30`,
            }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
              {date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
              {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
            {course.adresse_depart.split(',')[0]}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            → {course.adresse_arrivee.split(',')[0]}
          </div>
          {chauffeurNom && (
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>
              Chauffeur : {chauffeurNom}
            </div>
          )}
        </div>
        {/* Note existante */}
        {course.note_client && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: '#C9A84C', letterSpacing: 1 }}>
              {'★'.repeat(course.note_client)}{'☆'.repeat(5 - course.note_client)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>Votre note</div>
          </div>
        )}
      </div>
      {/* Widget de notation */}
      {peutNoter && (
        <NotationCourse courseId={course.id} chauffeurNom={chauffeurNom} />
      )}
      {/* Actions client — uniquement pour les courses en attente */}
      {course.statut === 'en_attente' && (
        <CourseActionsClient
          courseId={course.id}
          datePrevue={course.date_prevue}
          nbPassagers={(course as any).nb_passagers ?? 1}
        />
      )}
    </div>
  )
}
