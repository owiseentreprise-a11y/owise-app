import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import NouvelleCourseForm from './NouvelleCourseForm'

export const dynamic = 'force-dynamic'

export default async function NouvelleCourse() {
  await requireAdminClient()
  const supabase = createAdminClient()

  const [clientsRes, chauffeursRes, collabsRes, sousTraitantsRes, zonesRes, grilleRes, tarifsRes, paramsRes, coursesAssigneesRes] = await Promise.all([
    supabase.from('clients').select('id, entreprise_nom, type_compte, profiles(prenom, nom)'),
    supabase.from('chauffeurs').select('id, statut, vehicule_marque, vehicule_modele, sous_traitant_id, profiles(prenom, nom)')
      .in('statut', ['disponible', 'hors_ligne']).eq('actif', true),
    supabase.from('collaborateurs').select('id, client_id, nom, prenom, poste'),
    supabase.from('sous_traitants').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('zones').select('*').order('ordre'),
    supabase.from('grilles_tarifaires').select('*'),
    supabase.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    supabase.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,supplement_etape,tarif_pec_actif,tarif_frais_pec').single(),
    // Courses déjà assignées, pour signaler qu'un chauffeur est pris sur le créneau.
    supabase.from('courses')
      .select('id, chauffeur_id, date_prevue, adresse_depart, adresse_arrivee')
      .not('chauffeur_id', 'is', null)
      .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
      .gte('date_prevue', new Date(Date.now() - 12 * 3_600_000).toISOString()),
  ])

  // Un input datetime-local attend une heure LOCALE, or toISOString() renvoie de
  // l'UTC : en France (UTC+2 l'été) le défaut tombait une heure avant l'heure
  // réelle, donc dans le passé. Le serveur tournant en UTC, on formate
  // explicitement sur Europe/Paris plutôt que de se fier à son fuseau.
  const QUART_HEURE = 15 * 60_000
  const cible = new Date(Math.ceil((Date.now() + 3_600_000) / QUART_HEURE) * QUART_HEURE)
  const defaultDatetime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(cible).replace(' ', 'T')

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/admin/courses" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Courses
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Nouvelle course</div>
      </div>

      <div style={{ padding: '32px', maxWidth: 700 }}>
        <NouvelleCourseForm
          clients={clientsRes.data as any ?? []}
          collabs={collabsRes.data as any ?? []}
          chauffeurs={chauffeursRes.data as any ?? []}
          sousTraitants={sousTraitantsRes.data as any ?? []}
          zones={zonesRes.data as any ?? []}
          grille={grilleRes.data as any ?? []}
          tarifs={tarifsRes.data as any ?? []}
          params={paramsRes.data}
          defaultDatetime={defaultDatetime}
          coursesAssignees={coursesAssigneesRes.data as any ?? []}
        />
      </div>
    </>
  )
}
