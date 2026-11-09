/**
 * La facture telle qu'on la remet au client — prête à imprimer ou à
 * enregistrer en PDF depuis le navigateur.
 *
 * POURQUOI CETTE PAGE EXISTE
 *
 * Le PDF que le projet sait produire (`facture-pdf.ts`) était dessiné à la
 * main avec pdf-lib, en polices standard : il disait les montants, mais il ne
 * ressemblait pas au document qu'Owise envoie réellement. La facture remise à
 * SKORP Production le 2026-10-16 avait été composée à part, en HTML, et
 * l'exploitant l'a validée telle quelle.
 *
 * Cette page reprend cette maquette et la nourrit depuis la base. Elle vaut
 * donc pour TOUTES les factures : `Ctrl+P` → « Enregistrer au format PDF ».
 *
 * Le document lui-même vit dans `FeuilleFacture`, partagé avec la page de
 * l'espace client : les deux affichaient le même objet avec deux mises en
 * page différentes jusqu'au 2026-11-09.
 *
 * TOUT VIENT DE `chargerDocumentFacture()`, la source unique du contenu d'une
 * facture. Aucun libellé, aucun montant, aucune mention légale n'est réécrit
 * ici — la règle de CLAUDE.md tient : le document existe sous plusieurs
 * formes, il ne se définit qu'à un seul endroit.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { chargerDocumentFacture } from '@/lib/facture-document'
import { CSS_DOCUMENT as CSS } from '@/lib/document-feuille'
import FeuilleFacture from '@/components/FeuilleFacture'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const doc = await chargerDocumentFacture((await params).id)
  /* Le titre devient le nom du fichier PDF proposé par le navigateur. */
  return { title: doc ? `Facture ${doc.numero} — ${doc.client.nom}` : 'Facture', robots: { index: false } }
}

export default async function DocumentFacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let doc
  try {
    doc = await chargerDocumentFacture(id)
  } catch (e) {
    console.error('[facture/document] chargement impossible', id, e)
    throw e
  }
  if (!doc) {
    console.error('[facture/document] document vide pour', JSON.stringify(id))
    notFound()
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="fac-barre">
        <Link href={`/admin/facturation/${id}`} className="fac-retour">← Retour à la facture</Link>
        <span className="fac-aide">Ctrl+P puis « Enregistrer au format PDF »</span>
      </div>

      <FeuilleFacture doc={doc} />
    </>
  )
}

/* La feuille vit dans `@/lib/document-feuille` : le devis la partage. */
