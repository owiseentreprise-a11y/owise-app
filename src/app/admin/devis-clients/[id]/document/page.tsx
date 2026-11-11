/**
 * Le devis tel qu'on le remet au client — prêt à imprimer ou à enregistrer
 * en PDF depuis le navigateur.
 *
 * Le document lui-même vit dans `FeuilleDevis`, partagé avec la page
 * publique /devis/[jeton] où le client le lit et l’accepte. Cette page-ci
 * n'ajoute que la barre de retour et les feuilles de style.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CSS_DOCUMENT } from '@/lib/document-feuille'
import { CSS_DEVIS } from '@/lib/devis-feuille'
import FeuilleDevis from '@/components/FeuilleDevis'
import { chargerDevis, chargerPrestataire } from '@/lib/devis-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const devis = await chargerDevis((await params).id)
  return {
    title: devis ? `Devis ${devis.numero} — ${devis.client_nom}` : 'Devis',
    robots: { index: false },
  }
}

export default async function DocumentDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [devis, prestataire] = await Promise.all([chargerDevis(id), chargerPrestataire()])
  if (!devis) notFound()

  return (
    <>
      <style>{CSS_DOCUMENT}</style>
      <style>{CSS_DEVIS}</style>

      <div className="fac-barre">
        <Link href={`/admin/devis-clients/${id}`} className="fac-retour">← Retour au devis</Link>
        <span className="fac-aide">Ctrl+P puis « Enregistrer au format PDF »</span>
      </div>

      <FeuilleDevis devis={devis} prestataire={prestataire} />
    </>
  )
}
