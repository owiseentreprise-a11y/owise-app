import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import ReserverClient from './ReserverClient'
import TarifsReference from './TarifsReference'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Réserver un VTC — Tarif Instantané en Ligne | Owise',
  description: 'Calculez et réservez votre VTC en 30 secondes. Tarif fixe garanti, chauffeur professionnel, disponible 24h/24. Paris, Île-de-France, Oise. CDG, Orly, Beauvais.',
  keywords: ['réserver vtc', 'vtc en ligne', 'tarif vtc', 'chauffeur privé réservation', 'vtc paris réservation', 'prix vtc cdg', 'réservation vtc immédiate'],
  alternates: { canonical: 'https://www.owise.fr/reserver' },
  openGraph: {
    title: 'Réserver votre VTC | Owise — Tarif Fixe Garanti',
    description: 'Réservez votre chauffeur privé en ligne. Tarif calculé à l\'avance, confirmation immédiate. Paris, IDF & Oise.',
    url: 'https://www.owise.fr/reserver',
    siteName: 'Owise',
    locale: 'fr_FR',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default async function ReserverPage() {
  const admin    = createAdminClient()
  const supabase = await createClient()

  const [{ data: { user } }, zonesRes, grilleRes, tarifsRes, paramsRes] = await Promise.all([
    supabase.auth.getUser(),
    admin.from('zones').select('*').eq('active', true).order('ordre'),
    admin.from('grilles_tarifaires').select('*'),
    admin.from('tarifs').select('*'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,supplement_etape,tarif_pec_actif,tarif_frais_pec').single(),
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

  const ficheService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Réservation de VTC en ligne',
    serviceType: 'Transport avec chauffeur',
    provider: {
      '@type': ['LocalBusiness', 'TaxiService'],
      name: 'Owise',
      url: 'https://www.owise.fr',
      areaServed: ['Paris', 'Île-de-France', 'Oise'],
    },
    areaServed: ['Paris', 'Île-de-France', 'Oise'],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://www.owise.fr/reserver',
      availableLanguage: 'fr',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Forfaits aéroport',
      // Le véhicule est nommé dans chaque offre : ces montants sont ceux de la
      // berline. Sans cette mention, un assistant pourrait citer 59 € pour un
      // van, qui coûte moitié plus cher.
      itemListElement: forfaits.map(f => ({
        '@type': 'Offer',
        name: `${f.depart} → ${f.arrivee} — berline`,
        description: `Trajet ${f.depart} → ${f.arrivee} en berline, prix fixe TTC, péages et accueil compris.`,
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

  const ficheFilAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.owise.fr' },
      { '@type': 'ListItem', position: 2, name: 'Réserver', item: 'https://www.owise.fr/reserver' },
    ],
  }

  return (
    <>
      {/* Ces deux fiches décrivent la page à Google et aux assistants IA.
          Elles étaient absentes : /reserver ne déclarait rien du tout. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheService) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheFilAriane) }} />

      <ReserverClient
        zones={zonesRes.data ?? []}
        grille={grilleRes.data ?? []}
        tarifs={tarifsRes.data ?? []}
        params={paramsRes.data}
        profil={profil}
      />

      <TarifsReference forfaits={forfaits} />
    </>
  )
}
