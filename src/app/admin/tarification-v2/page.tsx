/**
 * /admin/tarification-v2 — LA NOUVELLE GRILLE, EN ESSAI.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md), étape 2.
 * Montre les deux tarifications côte à côte — l'actuelle, EN SERVICE, et la v2,
 * EN ESSAI — et permet de régler la v2 en voyant aussitôt l'effet sur les
 * courses passées. Aucun prix du site ne dépend de cette page.
 *
 * Le prix ACTUEL des trajets types est lu par prix-actuel.ts, seul fichier v2
 * autorisé à lire le calcul actuel (accord du 2026-11-21, déclaré dans
 * controle-prod-intacte.mjs). Ce fichier n'importe pas calcPrix directement.
 */
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lireGrilleV2, lireTarificationEnService, mesuresDepuisLigne, type LigneMesure } from '@/lib/tarification-v2/grille-db'
import { cleVehiculeV2, type CleVehiculeV2 } from '@/lib/tarification-v2/grille'
import { VEHICULES_V2 } from '@/lib/tarification-v2/grille-db'
import { prixActuel, chargerTarificationActuelle, type PrixActuel } from '@/lib/tarification-v2/prix-actuel'
import { dateCourse } from '@/lib/heure'
import GrilleV2Editeur, { type CoursePassee } from './GrilleV2Editeur'
import type { TrajetType } from './Simulations'

export const dynamic = 'force-dynamic'

export default async function TarificationV2Page() {
  await requireAdminClient()
  const sb = createAdminClient()

  const [grille, enService, tarification, trajetsRes, mesuresRes] = await Promise.all([
    lireGrilleV2(sb),
    lireTarificationEnService(sb),
    chargerTarificationActuelle(sb),
    sb.from('v2_trajets_types').select('id, groupe, ordre, depart, arrivee, depart_cp, arrivee_cp, distance_km, trajet_km, trajet_min, retour_km, retour_min, approches').order('ordre'),
    sb.from('v2_mesures_courses')
      .select('course_id, trajet_km, trajet_min, retour_km, retour_min, approches, mise_de_cote, courses(date_prevue, adresse_depart, adresse_arrivee, type_vehicule, prix_final, prix_estime)'),
  ])
  if (mesuresRes.error) throw new Error('v2_mesures_courses : ' + mesuresRes.error.message)
  if (trajetsRes.error) throw new Error('v2_trajets_types : ' + trajetsRes.error.message)

  /* Le prix actuel de chaque trajet type, avec les tarifs DU MOMENT : un
     forfait modifié dans « Tarifs » se voit ici au prochain chargement. */
  const trajetsTypes: TrajetType[] = (trajetsRes.data ?? []).map((t: any) => ({
    id: t.id, groupe: t.groupe, depart: t.depart, arrivee: t.arrivee,
    mesures: mesuresDepuisLigne({ ...t, course_id: t.id, mise_de_cote: null } as LigneMesure),
    actuel: Object.fromEntries(VEHICULES_V2.map(v => [v,
      prixActuel({ label: t.depart, cp: t.depart_cp }, { label: t.arrivee, cp: t.arrivee_cp }, Number(t.distance_km), v, tarification),
    ])) as Record<CleVehiculeV2, PrixActuel>,
  }))

  const courses: CoursePassee[] = (mesuresRes.data ?? [])
    .map((l: any) => {
      const c = Array.isArray(l.courses) ? l.courses[0] : l.courses
      return {
        id: l.course_id as string,
        instant: c.date_prevue as string,
        date: dateCourse(c.date_prevue, { day: '2-digit', month: '2-digit', year: '2-digit' }),
        depart: c.adresse_depart as string,
        arrivee: c.adresse_arrivee as string,
        vehiculeBrut: c.type_vehicule as string,
        vehicule: cleVehiculeV2(c.type_vehicule),
        encaisse: Number(c.prix_final ?? c.prix_estime ?? 0),
        mesures: mesuresDepuisLigne(l as LigneMesure),
        miseDeCote: l.mise_de_cote as string | null,
      }
    })
    .sort((a, b) => a.instant.localeCompare(b.instant))

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(17,17,40,.94)',
        borderBottom: '1px solid rgba(201,168,76,.12)', padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Tarification v2</div>
        <span className="v2-pastille v2-essai">En essai</span>
      </div>
      <GrilleV2Editeur grilleEnregistree={grille} enService={enService} courses={courses} trajetsTypes={trajetsTypes} />
    </>
  )
}
