/* La palette « Paris en mouvement » vit dans `vitrine.css`, sous
   `.vt.vt-palette-a`. On l'importe plutôt que d'en recopier les valeurs :
   une seule définition pour l'accueil, le blog, la FAQ et cette page. */
import '../vitrine.css'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import ReserverClient from './ReserverClient'
import TarifsReference from './TarifsReference'
import ParcoursEtQuestions, { QUESTIONS } from './ParcoursEtQuestions'
import { lireAvis } from '@/lib/identite-owise'
import { chargerParametres, paramsPourNavigateur } from '@/lib/tarification'
import { JUMEAU_RESERVATION, type Langue } from '@/lib/langue'

/**
 * La page de réservation, pour les deux langues.
 *
 * POURQUOI CE FICHIER EXISTE. `/reserver` et `/en/book` doivent charger les
 * MÊMES zones, la MÊME grille tarifaire et les MÊMES paramètres, et monter le
 * MÊME `ReserverClient`. Dupliquer la page aurait produit deux chemins de
 * chargement : il aurait suffi qu'une colonne soit ajoutée à l'un pour que
 * l'autre retombe silencieusement sur une valeur de repli — et qu'un
 * étranger se voie annoncer un prix que l'application ne facture pas.
 *
 * Donc : une seule page, un paramètre de langue. Ce qui dépend de la langue
 * est limité à trois choses, toutes d'affichage : les textes (par
 * `langue.ts`), la langue déclarée dans les fiches structurées, et le fil
 * d'Ariane.
 */

const BASE = 'https://www.owise.fr'

export default async function PageReservation({ langue }: { langue: Langue }) {
  const admin    = createAdminClient()
  const avis = await lireAvis(admin)
  const supabase = await createClient()

  const [{ data: { user } }, zonesRes, grilleRes, tarifsRes, paramsRes] = await Promise.all([
    supabase.auth.getUser(),
    admin.from('zones').select('*').eq('active', true).order('ordre'),
    admin.from('grilles_tarifaires').select('*'),
    admin.from('tarifs').select('*'),
    chargerParametres(admin).then(d => ({ data: d })),
  ])

  let profil: { prenom: string; nom: string; email: string; telephone: string } | null = null
  if (user) {
    const { data: p } = await admin
      .from('profiles')
      .select('prenom, nom, telephone')
      .eq('id', user.id)
      .single()
    if (p) {
      profil = {
        prenom:    p.prenom    ?? '',
        nom:       p.nom       ?? '',
        email:     user.email  ?? '',
        telephone: p.telephone ?? '',
      }
    }
  }

  // Forfaits de référence affichés sous le formulaire.
  //
  // Les couples de zones sont un choix éditorial ; les montants, jamais :
  // ils sont lus dans `grilles_tarifaires`. Un couple sans prix en base est
  // retiré de la liste au lieu d'afficher une valeur de repli — sans quoi la
  // page annoncerait un tarif que l'application ne facture pas.
  const COUPLES: [string, string][] = [
    ['CHA', 'CDG'], ['CRL', 'CDG'], ['SEN', 'CDG'], ['RPF', 'CDG'],
    ['Z1', 'CDG'],  ['COM', 'CDG'], ['BEA', 'CDG'], ['ORY', 'CDG'],
    ['Z1', 'ORY'],  ['CHA', 'ORY'], ['CRL', 'ORY'], ['COM', 'ORY'],
    ['CHA', 'BVA'], ['CRL', 'BVA'], ['Z1', 'BVA'],
  ]
  const parCode = new Map((zonesRes.data ?? []).map(z => [z.code, z]))
  const forfaits = COUPLES.flatMap(([cd, ca]) => {
    const zd = parCode.get(cd), za = parCode.get(ca)
    if (!zd || !za) return []
    const ligne = (grilleRes.data ?? []).find(
      g => g.zone_depart_id === zd.id && g.zone_arrivee_id === za.id,
    )
    const prix = Number(ligne?.prix_berline ?? 0)
    if (!prix) return []
    return [{ depart: zd.nom as string, arrivee: za.nom as string, prix }]
  })

  const url = `${BASE}${JUMEAU_RESERVATION[langue]}`
  const en = langue === 'en'

  const ficheService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: en ? 'Online chauffeur booking' : 'Réservation de VTC en ligne',
    serviceType: en ? 'Private car with driver' : 'Transport avec chauffeur',
    provider: {
      '@type': ['LocalBusiness', 'TaxiService'],
      name: 'Owise',
      url: BASE,
      areaServed: ['Paris', 'Île-de-France', 'Oise'],
    },
    areaServed: ['Paris', 'Île-de-France', 'Oise'],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: url,
      /* La langue déclarée est celle de CETTE page. Annoncer « fr » sur la
         page anglaise dirait à un assistant que l'anglophone n'est pas
         servi — exactement l'inverse de ce que la page existe pour faire. */
      availableLanguage: langue,
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: en ? 'Airport fixed fares' : 'Forfaits aéroport',
      // Le véhicule est nommé dans chaque offre : ces montants sont ceux de la
      // berline. Sans cette mention, un assistant pourrait citer 59 € pour un
      // van, qui coûte moitié plus cher.
      itemListElement: forfaits.map(f => ({
        '@type': 'Offer',
        name: en ? `${f.depart} → ${f.arrivee} — sedan` : `${f.depart} → ${f.arrivee} — berline`,
        description: en
          ? `${f.depart} → ${f.arrivee} by sedan, fixed price including VAT, tolls and meet-and-greet.`
          : `Trajet ${f.depart} → ${f.arrivee} en berline, prix fixe TTC, péages et accueil compris.`,
        priceCurrency: 'EUR',
        price: String(f.prix),
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: String(f.prix),
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: true,
        },
      })),
    },
  }

  /* Les questions ne sont pas recopiées ici : elles sont lues dans le même
     tableau que celui affiché par ParcoursEtQuestions. Une fiche FAQPage qui
     dit autre chose que la page qu'elle décrit est une fiche fausse — et
     c'est exactement ainsi que cinq politiques d'annulation ont coexisté.

     Elle n'est émise QUE sur la page française, parce que `QUESTIONS` n'est
     écrit qu'en français. Émettre une FAQPage française sur la page anglaise
     donnerait à un assistant des réponses dans la mauvaise langue pour un
     lecteur anglophone — soit le contraire du but. La traduction de ces
     questions est le lot suivant. */
  const ficheQuestions = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map(({ q, r }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: r },
    })),
  }

  const ficheFilAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: en ? 'Home' : 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: en ? 'Book' : 'Réserver', item: url },
    ],
  }

  return (
    /* La classe de palette est posée ICI, et non dans `ReserverClient` :
       `TarifsReference` et `ParcoursEtQuestions` en sont des frères, pas des
       descendants. Placée plus bas, elle les laissait retomber sur les jetons
       de `globals.css` — mesuré le 2026-11-01 : 11 échecs de contraste, tous
       dans ces deux blocs, avec un gris #7A7A96 sur un bleu #161630 qui
       n'appartiennent à aucune des deux palettes du site. */
    <div className="vt vt-palette-a" lang={langue}>
      {/* Ces fiches décrivent la page à Google et aux assistants IA.
          Elles étaient absentes : /reserver ne déclarait rien du tout. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheService) }} />
      {!en && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheQuestions) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheFilAriane) }} />

      <ReserverClient
        avis={avis}
        zones={zonesRes.data ?? []}
        grille={grilleRes.data ?? []}
        tarifs={tarifsRes.data ?? []}
        params={paramsPourNavigateur(paramsRes.data)}
        profil={profil}
        langue={langue}
      />

      <TarifsReference forfaits={forfaits} langue={langue} />

      {/* Le parcours et les questions ne sont qu'en français pour l'instant.
          Mieux vaut une page anglaise plus courte qu'une page anglaise qui
          bascule en français à mi-hauteur. */}
      {!en && <ParcoursEtQuestions />}
    </div>
  )
}
