import { notFound } from 'next/navigation'
import { chargerDevis } from '@/lib/devis-client'
import EditeurDevis from './EditeurDevis'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const devis = await chargerDevis((await params).id)
  return { title: devis ? `Devis ${devis.numero}` : 'Devis', robots: { index: false } }
}

export default async function DevisClientPage({ params }: { params: Promise<{ id: string }> }) {
  const devis = await chargerDevis((await params).id)
  if (!devis) notFound()
  return <EditeurDevis devis={devis} />
}
