import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MOIS_CONSERVATION_SIMULATIONS } from '@/lib/conservation'

/**
 * Efface le détail nominatif des vieilles estimations.
 *
 * Depuis le 2026-11-09, chaque estimation garde l'adresse exacte tapée par le
 * visiteur, la page et le canal d'arrivée — décision de l'exploitant, qui en a
 * besoin pour auditer ses prix. Ce détail n'a d'utilité que récent : on audite
 * la demande du trimestre, pas celle d'il y a deux ans.
 *
 * Cette tâche vide donc les colonnes de détail au-delà de la durée annoncée
 * dans les mentions légales. Elle **ne supprime aucune ligne** : la statistique
 * elle-même (commune, zone, véhicule, prix) est conservée, c'est elle qui fait
 * l'historique. Seules les adresses exactes et le référent disparaissent.
 *
 * La durée vient de `src/lib/conservation.ts` et de nulle part ailleurs : les
 * mentions légales l'annoncent au visiteur, cette tâche l'applique. Si les
 * deux divergeaient, la page mentirait — `scripts/test-detail-visiteur.mts`
 * vérifie que le texte publié porte bien ce nombre.
 */

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limite = new Date()
  limite.setMonth(limite.getMonth() - MOIS_CONSERVATION_SIMULATIONS)

  const supabase = createAdminClient()

  /* On ne touche qu'aux lignes qui portent encore du détail : sans ce filtre,
     la tâche réécrirait chaque jour toutes les lignes anciennes pour rien. */
  const { data, error } = await supabase
    .from('estimations')
    .update({
      adresse_depart_saisie:  null,
      adresse_arrivee_saisie: null,
      referent:     null,
      utm_source:   null,
      utm_campaign: null,
    })
    .lt('created_at', limite.toISOString())
    .not('adresse_depart_saisie', 'is', null)
    .select('id')

  if (error) {
    console.error('[purge-estimations]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const effacees = data?.length ?? 0
  console.log(`[purge-estimations] ${effacees} estimation(s) anonymisée(s), limite ${limite.toISOString()}`)
  return NextResponse.json({ ok: true, effacees, mois: MOIS_CONSERVATION_SIMULATIONS })
}
