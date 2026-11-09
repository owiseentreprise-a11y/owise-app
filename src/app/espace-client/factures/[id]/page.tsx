/**
 * La facture, vue par le client dans son espace.
 *
 * POURQUOI ELLE A ÉTÉ REFAITE (2026-11-09)
 *
 * Cette page composait sa PROPRE mise en page de la facture, avec sa propre
 * lecture de la table `parametres`. C'était la troisième des quatre formes
 * d'une même facture, et la seule que le client connecté voyait. Elle ne
 * disait pas la même chose que les autres :
 *
 *   - aucune mention légale — ni le régime de TVA, ni les pénalités de
 *     retard — alors que la page d'administration les affichait ;
 *   - un en-tête en or sur fond sombre, quand le document est crème ;
 *   - sa propre requête sur `parametres`, donc sa propre idée de l'identité
 *     de l'entreprise.
 *
 * L'exploitant : « on voit pas les mêmes informations sur l'entreprise ».
 *
 * Elle rend maintenant `FeuilleFacture`, le même document que
 * /admin/facturation/[id]/document, nourri par `chargerDocumentFacture()`.
 *
 * CE QUI RESTE PROPRE À CETTE PAGE : le contrôle d'accès, le bouton de
 * paiement et la bannière de confirmation. Le document, lui, est partagé.
 *
 * SÉCURITÉ — l'ordre compte. `chargerDocumentFacture()` lit avec la clé de
 * service et ne vérifie aucun droit : elle rendrait n'importe quelle facture
 * à n'importe qui. On vérifie donc D'ABORD, avec le client Supabase de
 * l'utilisateur et un filtre `client_id`, que cette facture est bien la
 * sienne ; on ne charge le document qu'ensuite.
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import PayerButton from './PayerButton'
import FeuilleFacture from '@/components/FeuilleFacture'
import { chargerDocumentFacture } from '@/lib/facture-document'
import { CSS_DOCUMENT } from '@/lib/document-feuille'

export const dynamic = 'force-dynamic'

export default async function ClientFacturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ paid?: string }>
}) {
  const { id } = await params
  const { paid } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  /* Le contrôle d'accès, avec le client de l'UTILISATEUR : le filtre
     `client_id` ne rend la ligne que si la facture lui appartient. */
  const { data: appartenance } = await supabase
    .from('factures')
    .select('id, statut')
    .eq('id', id)
    .eq('client_id', user.id)
    .single()

  if (!appartenance) notFound()

  const doc = await chargerDocumentFacture(id)
  if (!doc) notFound()

  return (
    <>
      <style>{CSS_DOCUMENT}</style>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Retour + actions */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
        }}>
          <Link href="/espace-client" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Retour
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {appartenance.statut !== 'payee' && <PayerButton factureId={id} />}
            <PrintButton />
          </div>
        </div>

        {/* Bannière confirmation paiement */}
        {paid === '1' && (
          <div className="no-print" style={{
            marginBottom: 4, padding: '12px 18px', borderRadius: 10,
            background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: 'var(--green)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
            </svg>
            Paiement reçu — votre facture sera marquée payée sous quelques instants.
          </div>
        )}

        <FeuilleFacture doc={doc} />
      </div>
    </>
  )
}
