/**
 * Le brouillon, avant envoi.
 *
 * Cet écran existe pour une raison précise : le 2026-11-02, une réponse est
 * partie chez une cliente avec « [à compléter selon vos conditions] » dedans.
 * Rien ne la montrait avant le clic.
 *
 * Ce qui s'affiche ici est le résultat de `composerEmailDevis`, et c'est
 * littéralement l'objet que `envoyerDevisAction` expédie — pas une
 * reconstitution. Un aperçu qui recompose de son côté finit par montrer
 * autre chose que ce qui part.
 */
import { notFound } from 'next/navigation'
import { chargerDevis, chargerPrestataire } from '@/lib/devis-client'
import { composerEmailDevis, composerReponseDevis, trouRestant } from '@/lib/devis-email'
import { FROM_DEVIS, REPONSE_DEVIS } from '@/lib/email'
import BrouillonEnvoi from './BrouillonEnvoi'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const devis = await chargerDevis((await params).id)
  return {
    title: devis ? `Envoyer le devis ${devis.numero}` : 'Envoyer le devis',
    robots: { index: false },
  }
}

export default async function EnvoiDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [devis, prestataire] = await Promise.all([chargerDevis(id), chargerPrestataire()])
  if (!devis) notFound()

  const message = composerEmailDevis(devis, prestataire)
  const reponse = composerReponseDevis(devis, prestataire)

  return (
    <BrouillonEnvoi
      id={id}
      numero={devis.numero}
      client={devis.client_societe || devis.client_nom}
      statut={devis.statut}
      destinataire={message.destinataire}
      sujet={message.sujet}
      html={message.html}
      texte={message.texte}
      reponseHtml={reponse.html}
      reponseTexte={reponse.texte}
      piece={`${devis.numero.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`}
      expediteur={FROM_DEVIS}
      repondreA={REPONSE_DEVIS}
      trou={trouRestant(message.texte)}
      aucuneLigne={devis.lignes.length === 0}
    />
  )
}
