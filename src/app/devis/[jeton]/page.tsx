/**
 * Le devis, vu par le CLIENT, derrière son lien privé.
 *
 * POURQUOI CETTE PAGE
 *
 * L'exploitant, le 2026-11-11 : « une fois qu'on a accepté, on lui envoie
 * l'acceptation, mais elle doit mettre sa carte bleue pour valider la
 * réservation ». Jusqu'ici le client n'avait aucun moyen de s'engager —
 * c'était l'exploitant qui décidait seul, dans l'administration, que le devis
 * était accepté, et le client ne recevait rien.
 *
 * AUCUNE CONNEXION DEMANDÉE. Demander un compte pour accepter un devis ferait
 * fuir la moitié des gens. La page se protège par un jeton tiré au hasard,
 * impossible à deviner et propre à ce devis — voir `devis-jeton.ts`.
 *
 * ELLE MONTRE LE MÊME DOCUMENT que celui que l'exploitant imprime :
 * `FeuilleDevis`, partagé. Une facture a existé en quatre dessins sur ce
 * projet et il a fallu une journée pour les réunir ; on ne recommence pas.
 */
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerDevisParJeton, chargerPrestataire, dateCourte } from '@/lib/devis-client'
import { CSS_DOCUMENT } from '@/lib/document-feuille'
import { CSS_DEVIS } from '@/lib/devis-feuille'
import FeuilleDevis from '@/components/FeuilleDevis'
import BandeauAcceptation from './BandeauAcceptation'
import { aujourdhuiParis } from '@/lib/heure'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ jeton: string }> }) {
  const devis = await chargerDevisParJeton((await params).jeton)
  return {
    title: devis ? `Votre devis ${devis.numero} — Owise` : 'Devis — Owise',
    /* Jamais dans un moteur de recherche : c'est le document d'une personne. */
    robots: { index: false, follow: false },
  }
}

export default async function DevisPublicPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const [devis, prestataire] = await Promise.all([
    chargerDevisParJeton(jeton),
    chargerPrestataire(),
  ])
  if (!devis) notFound()

  /* On note la PREMIÈRE ouverture, et seulement elle : l'exploitant veut
     savoir si son devis a été lu, pas combien de fois. Écriture discrète, qui
     n'empêche jamais l'affichage si elle échoue. */
  if (!devis.vu_le) {
    createAdminClient()
      .from('devis_clients')
      .update({ vu_le: new Date().toISOString() })
      .eq('id', devis.id)
      .is('vu_le', null)
      .then(({ error }) => {
        if (error) console.error('[DEVIS VU] écriture impossible', devis.id, error)
      })
  }

  /* EXPIRÉ OU NON : on compare des JOURS de Paris, pas des instants.
     Première écriture : `new Date(\`${'${date}'}T23:59:59+01:00\`)`. Le « +01:00 »
     était tapé à la main, donc faux six mois par an — Paris est à +02:00 en
     été, et un devis valable jusqu'au 30 juin expirait une heure trop tôt.
     `aujourdhuiParis()` rend « 2026-11-11 », et deux dates ISO se comparent
     correctement comme du texte. Règle de @/lib/heure : aucun fuseau écrit
     à la main hors de ce fichier. */
  const expire = devis.date_validite
    ? aujourdhuiParis() > devis.date_validite
    : false

  return (
    <>
      <style>{CSS_DOCUMENT}</style>
      <style>{CSS_DEVIS}</style>

      <BandeauAcceptation
        jeton={jeton}
        numero={devis.numero}
        montant={Number(devis.total_ht)}
        carteRequise={devis.carte_requise}
        dejaAccepte={!!devis.accepte_le}
        expire={expire}
        valableJusquau={dateCourte(devis.date_validite)}
      />

      <FeuilleDevis devis={devis} prestataire={prestataire} />
    </>
  )
}
