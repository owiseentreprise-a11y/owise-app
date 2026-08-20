import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import './vitrine.css'

const BASE = 'https://www.owise.fr'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: 'Owise — Transport VTC de Prestige · Paris, IDF & Oise',
  description:
    'Chauffeurs VTC professionnels à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Réservation en ligne immédiate.',
  keywords: [
    'VTC Paris',
    'chauffeur privé Paris',
    'transfert aéroport CDG',
    'transfert aéroport Orly',
    'VTC Île-de-France',
    'VTC Oise',
    'taxi luxe Paris',
    'chauffeur entreprise Paris',
    'VTC Compiègne',
    'VTC Chantilly',
    'réservation VTC en ligne',
  ],
  robots: { index: true, follow: true },
  authors: [{ name: 'Owise', url: BASE }],
  alternates: { canonical: `${BASE}/` },
  openGraph: {
    type: 'website',
    url: `${BASE}/`,
    title: 'Owise — Transport VTC de Prestige · Paris & IDF',
    description:
      "Chauffeurs professionnels, tarif fixe garanti, disponible 24h/24. Réservez votre VTC à Paris, en IDF et dans l'Oise.",
    locale: 'fr_FR',
    siteName: 'Owise',
    images: [{ url: `${BASE}/brand_assets/hero-car.jpg`, width: 1672, height: 941, alt: 'Owise — Chauffeur privé Paris, IDF & Oise' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owise — Transport VTC de Prestige',
    description: 'VTC haut de gamme à Paris. Tarif fixe, chauffeurs certifiés, disponible 24h/24.',
    images: [`${BASE}/brand_assets/hero-car.jpg`],
  },
  icons: {
    icon: '/brand_assets/favicon.svg',
    apple: '/brand_assets/favicon.svg',
  },
}

// JSON-LD structuré pour les moteurs de recherche
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': ['TaxiService', 'LocalBusiness'],
  name: 'Owise — Chauffeur Privé VTC',
  description: 'Service VTC de prestige à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Creil, Chantilly, Senlis, Compiègne.',
  url: BASE,
  logo: `${BASE}/brand_assets/logo.svg`,
  image: `${BASE}/brand_assets/hero-car.webp`,
  telephone: '+33619106356',
  email: 'owise.entreprise@gmail.com',
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Cash, Credit Card, Stripe',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Creil',
    addressRegion: 'Oise',
    postalCode: '60100',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 49.2583,
    longitude: 2.4797,
  },
  areaServed: [
    { '@type': 'City', name: 'Paris' },
    { '@type': 'State', name: 'Île-de-France' },
    { '@type': 'City', name: 'Creil' },
    { '@type': 'City', name: 'Chantilly' },
    { '@type': 'City', name: 'Senlis' },
    { '@type': 'City', name: 'Compiègne' },
    { '@type': 'City', name: 'Beauvais' },
    { '@type': 'City', name: 'Gouvieux' },
    { '@type': 'City', name: 'Lamorlaye' },
    { '@type': 'City', name: 'Pontoise' },
    { '@type': 'City', name: 'Cergy' },
    { '@type': 'City', name: 'Versailles' },
    { '@type': 'AdministrativeArea', name: 'Oise' },
    { '@type': 'AdministrativeArea', name: 'Val-d\'Oise' },
  ],
  priceRange: '€€',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    opens: '00:00',
    closes: '23:59',
  },
  potentialAction: {
    '@type': 'ReserveAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE}/reserver`,
      actionPlatform: [
        'http://schema.org/DesktopWebPlatform',
        'http://schema.org/MobileWebPlatform',
      ],
    },
    result: { '@type': 'Reservation', name: 'Réservation VTC Owise' },
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services VTC Owise',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport CDG', description: 'Paris → CDG dès 65€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport Orly', description: 'Paris → Orly dès 50€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport Beauvais', description: 'Oise → BVA dès 40€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'VTC Creil / Oise → CDG', description: 'Creil → CDG dès 65€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Compte entreprise VTC', description: 'Facturation mensuelle, multi-collaborateurs' } },
    ],
  },
  sameAs: ['https://owise.fr', 'https://facebook.com/Owise.vtc', 'https://www.tiktok.com/@owise857'],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    reviewCount: '4',
    bestRating: '5',
    worstRating: '1',
  },
}

export const revalidate = 3600

export default async function VitrinePage() {
  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }, { data: grille }, { data: params }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code','HORS').eq('active', true),
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} grille={grille ?? []} params={params} />

      {/* Section maillage interne — server-rendered, visible par Google */}
      <section style={{ background: '#F8F6F1', padding: '64px 24px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 500, color: '#09091A', marginBottom: 8, textAlign: 'center' }}>
            Nos zones desservies
          </h2>
          <p style={{ textAlign: 'center', color: '#848499', fontSize: 15, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            Chauffeur privé disponible 24h/24 à Paris, en Île-de-France et dans l&apos;Oise. Tarif fixe garanti depuis votre adresse.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { slug: 'vtc-aeroport-cdg',      title: 'VTC Aéroport CDG',              prix: 'dès 65€',  desc: 'Transfert Charles de Gaulle, suivi de vol' },
              { slug: 'vtc-aeroport-orly',     title: 'VTC Aéroport Orly',             prix: 'dès 50€',  desc: 'Transfert Paris-Orly, tous terminaux' },
              { slug: 'vtc-aeroport-beauvais', title: 'VTC Aéroport Beauvais-Tillé',   prix: 'dès 40€',  desc: 'Hub Ryanair & Wizzair depuis l\'Oise' },
              { slug: 'vtc-creil',             title: 'VTC Creil & Oise Sud',           prix: 'dès 65€',  desc: 'Senlis, Chantilly, Lamorlaye, Saint-Maximin' },
              { slug: 'vtc-chantilly',         title: 'VTC Chantilly',                  prix: 'dès 70€',  desc: 'Château, Hippodrome, hôtels de prestige' },
              { slug: 'vtc-senlis',            title: 'VTC Senlis & Environs',          prix: 'dès 70€',  desc: 'Cité médiévale, Forêt de Chantilly' },
              { slug: 'vtc-gouvieux',          title: 'VTC Gouvieux & Lamorlaye',       prix: 'dès 70€',  desc: 'Coye-la-Forêt, Orry-la-Ville, Précy' },
              { slug: 'vtc-lamorlaye',         title: 'VTC Lamorlaye',                  prix: 'dès 70€',  desc: 'Forêt de Chantilly, Boran-sur-Oise' },
              { slug: 'vtc-compiegne',         title: 'VTC Compiègne',                  prix: 'dès 100€', desc: 'Margny, Venette, Oise Nord' },
              { slug: 'vtc-pontoise',          title: 'VTC Pontoise & Cergy',           prix: 'dès 55€',  desc: 'Val-d\'Oise, Saint-Ouen-l\'Aumône' },
              { slug: 'vtc-versailles',        title: 'VTC Versailles & Yvelines',      prix: 'dès 80€',  desc: 'Château, Vélizy, Saint-Quentin-en-Yvelines' },
              { slug: 'vtc-coye-la-foret',     title: 'VTC Coye-la-Forêt',             prix: 'dès 65€',  desc: 'Forêt de Chantilly, Lamorlaye, Orry-la-Ville' },
              { slug: 'vtc-orry-la-ville',     title: 'VTC Orry-la-Ville',             prix: 'dès 60€',  desc: 'Entre Chantilly et CDG, Mortefontaine' },
              { slug: 'vtc-la-chapelle-en-serval', title: 'VTC La Chapelle-en-Serval', prix: 'dès 60€',  desc: 'Proche A1, Mortefontaine, Plailly' },
              { slug: 'vtc-boran-sur-oise',    title: 'VTC Boran-sur-Oise',            prix: 'dès 80€',  desc: 'Vallée de l\'Oise, Précy, Mesnil-en-Thelle' },
              { slug: 'vtc-precy-sur-oise',    title: 'VTC Précy-sur-Oise',            prix: 'dès 85€',  desc: 'Oise Nord, Boran, Villeneuve-sur-Verberie' },
              { slug: 'vtc-luzarches',         title: 'VTC Luzarches',                 prix: 'dès 65€',  desc: 'Pays de France, Asnières-sur-Oise, Val-d\'Oise' },
              { slug: 'vtc-clermont',          title: 'VTC Clermont (Oise)',           prix: 'dès 105€', desc: 'Clermontois, Agnetz, Breuil-le-Vert, Étouy' },
              { slug: 'vtc-liancourt',         title: 'VTC Liancourt · Rantigny',      prix: 'dès 100€', desc: 'Rantigny, Cauffry, Laigneville, Monchy-Saint-Éloi' },
            ].map(d => (
              <a key={d.slug} href={`/${d.slug}`} style={{ display: 'block', background: '#fff', borderRadius: 12, padding: '20px 20px', textDecoration: 'none', border: '1px solid rgba(9,9,26,.06)', transition: 'box-shadow .15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#09091A' }}>{d.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A84C', whiteSpace: 'nowrap', marginLeft: 8 }}>{d.prix}</span>
                </div>
                <span style={{ fontSize: 12, color: '#848499', lineHeight: 1.5 }}>{d.desc}</span>
              </a>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a href="/blog" style={{ fontSize: 13, color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>
              Voir nos guides et conseils VTC →
            </a>
          </div>
        </div>
      </section>

      {/* Section avis Google */}
      <section style={{ background: '#09091A', padding: '56px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
            Avis clients
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 500, color: '#EDE8DF', margin: '0 0 8px' }}>
            Ils nous font confiance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
            <span style={{ fontSize: 22, letterSpacing: 2 }}>★★★★★</span>
            <span style={{ fontSize: 14, color: '#848499' }}>
              <span style={{ color: '#EDE8DF', fontWeight: 600 }}>5 / 5</span>
              {' · '}4 avis Google vérifiés
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {[
              { text: 'Service de transport très professionnel, ponctuel et sérieux. Tout s\'est très bien passé du début à la fin. Je recommande sans hésiter !', auteur: 'Nabila B.' },
              { text: 'Très bonne prestation, chauffeur ponctuel et serviable.', auteur: 'Joëlle P.' },
              { text: 'Excellentes prestations. Ponctualité. À recommander.', auteur: 'Michèle M.' },
              { text: 'Impeccable, un service au top.', auteur: 'Khacim D.' },
            ].map((avis, i) => (
              <div key={i} style={{
                background: '#111128', borderRadius: 12, padding: '22px 24px',
                border: '1px solid rgba(201,168,76,.1)',
                maxWidth: 260, textAlign: 'left', flex: '1 1 220px',
              }}>
                <div style={{ fontSize: 14, color: '#C9A84C', marginBottom: 10, letterSpacing: 1 }}>★★★★★</div>
                <p style={{ fontSize: 13, color: '#EDE8DF', lineHeight: 1.7, margin: '0 0 14px' }}>&ldquo;{avis.text}&rdquo;</p>
                <div style={{ fontSize: 11, color: '#848499' }}>{avis.auteur} · Google</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://g.page/r/CY0-ORyXWwpXEAE/review"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', background: '#C9A84C', color: '#09091A',
                textDecoration: 'none', padding: '12px 28px', borderRadius: 8,
                fontSize: 13, fontWeight: 700,
              }}
            >
              Laisser un avis →
            </a>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Owise+VTC"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', background: 'transparent', color: '#EDE8DF',
                textDecoration: 'none', padding: '12px 28px', borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(237,232,223,.15)',
              }}
            >
              Voir tous les avis
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
