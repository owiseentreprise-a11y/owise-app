/**
 * Version Markdown d'une page ville ou trajet.
 *
 * La plupart des agents n'exécutent pas JavaScript et n'ont pas besoin de la
 * mise en page : leur servir du Markdown compact leur épargne le tri d'une
 * page complète, et nous épargne qu'ils se trompent en la triant.
 *
 * Construite depuis `DESTINATIONS` — la même source que la page HTML — et non
 * en relisant le HTML : deux extractions divergent toujours au bout d'un
 * moment, et c'est de là que viennent les prix ou les durées contradictoires.
 *
 * Découverte : un en-tête `Link` sur la page HTML pointe ici (voir
 * `next.config.ts`).
 */
import { NextResponse } from 'next/server'
import { DESTINATIONS, DESTINATION_SLUGS } from '../../[destination]/page'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return DESTINATION_SLUGS.map(slug => ({ slug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = (DESTINATIONS as Record<string, {
    title: string; h1: string; intro: string; prix: string; duree: string
    metaDesc: string
    zones?: { nom: string; cp: string; km?: string }[]
    faq?: { q: string; a: string }[]
  }>)[slug]

  if (!d) return new NextResponse('Not found', { status: 404 })

  const url = `https://www.owise.fr/${slug}`
  const l: string[] = []

  l.push(`# ${d.h1}`, '')
  l.push(`> ${d.metaDesc}`, '')
  l.push(`Page : ${url}`, '')

  l.push('| | |', '|---|---|')
  l.push(`| Prix | ${d.prix} |`)
  l.push(`| Durée | ${d.duree} |`)
  l.push('| Disponibilité | 24h/24, 7j/7 |')
  l.push('| Téléphone | 06 19 10 63 56 |')
  l.push('| Réservation | https://www.owise.fr/reserver |')
  l.push('')

  l.push('## Présentation', '', d.intro, '')

  if (d.zones?.length) {
    l.push('## Communes desservies au même tarif', '')
    for (const z of d.zones) l.push(`- ${z.nom} (${z.cp})${z.km ? ` — ${z.km}` : ''}`)
    l.push('')
  }

  if (d.faq?.length) {
    l.push('## Questions fréquentes', '')
    for (const q of d.faq) l.push(`### ${q.q}`, '', q.a, '')
  }

  l.push('---', '')
  l.push('Owise — Chauffeur privé VTC · Saint-Maximin (60740), Oise · https://www.owise.fr')

  return new NextResponse(l.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
