/**
 * /admin/tarification-v2 — LA NOUVELLE GRILLE, EN ESSAI.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md), étape 2.
 * Montre les deux tarifications côte à côte — l'actuelle, EN SERVICE, et la v2,
 * EN ESSAI — et permet de régler la v2 en voyant aussitôt l'effet sur les
 * courses passées. Aucun prix du site ne dépend de cette page.
 *
 * Ce fichier n'importe RIEN du calcul actuel (calcPrix, tarification…) : la
 * règle 1 de la charte, vérifiée par controle-prod-intacte.mjs.
 */
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lireGrilleV2, lireTarificationEnService, mesuresDepuisLigne, type LigneMesure } from '@/lib/tarification-v2/grille-db'
import { cleVehiculeV2 } from '@/lib/tarification-v2/grille'
import { dateCourse } from '@/lib/heure'
import GrilleV2Editeur, { type CoursePassee } from './GrilleV2Editeur'

export const dynamic = 'force-dynamic'

export default async function TarificationV2Page() {
  await requireAdminClient()
  const sb = createAdminClient()

  const [grille, enService, mesuresRes] = await Promise.all([
    lireGrilleV2(sb),
    lireTarificationEnService(sb),
    sb.from('v2_mesures_courses')
      .select('course_id, trajet_km, trajet_min, retour_km, retour_min, approches, mise_de_cote, courses(date_prevue, adresse_depart, adresse_arrivee, type_vehicule, prix_final, prix_estime)'),
  ])
  if (mesuresRes.error) throw new Error('v2_mesures_courses : ' + mesuresRes.error.message)

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
      <GrilleV2Editeur grilleEnregistree={grille} enService={enService} courses={courses} />
    </>
  )
}
