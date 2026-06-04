import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import '../vitrine.css'

const DESTINATIONS: Record<string, {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  keywords: string[]
  h1: string
  intro: string
  prix: string
  duree: string
  faq: { q: string; a: string }[]
}> = {
  'vtc-aeroport-cdg': {
    slug: 'vtc-aeroport-cdg',
    title: 'VTC Aéroport CDG',
    metaTitle: 'VTC Aéroport CDG — Transfert Charles de Gaulle | Owise',
    metaDesc: 'Transfert VTC vers l\'aéroport Charles de Gaulle (CDG) depuis Paris et IDF. Tarif fixe garanti, suivi de vol, disponible 24h/24. Réservation en ligne immédiate.',
    keywords: ['vtc cdg','transfert aéroport cdg','chauffeur privé charles de gaulle','vtc roissy','taxi cdg paris'],
    h1: 'VTC Aéroport Charles de Gaulle (CDG)',
    intro: 'Votre transfert vers l\'aéroport Paris-CDG avec un chauffeur professionnel. Tarif fixe garanti, suivi de vol en temps réel, prise en charge dans le hall d\'arrivée.',
    prix: 'dès 45€',
    duree: '25–55 min selon votre départ',
    faq: [
      { q: 'Combien coûte un VTC de Paris vers CDG ?', a: 'Le tarif est fixe et calculé à l\'avance. Depuis Paris intramuros, comptez entre 55€ et 75€ selon le véhicule. Utilisez notre estimateur pour un prix exact depuis votre adresse.' },
      { q: 'Mon chauffeur attend-il si mon vol est retardé ?', a: 'Oui. Nous suivons votre vol en temps réel. En cas de retard, votre chauffeur ajuste son heure d\'arrivée sans frais supplémentaires.' },
      { q: 'Où est-ce que mon chauffeur m\'attend à CDG ?', a: 'Votre chauffeur vous attend dans le hall des arrivées avec une pancarte à votre nom. Nous précisons le terminal exact dans votre confirmation de réservation.' },
      { q: 'Peut-on réserver un VTC CDG à la dernière minute ?', a: 'Oui, pour les courses immédiates disponibles 24h/24. Nous recommandons de réserver à l\'avance pour garantir la disponibilité, surtout aux heures de pointe.' },
    ],
  },
  'vtc-aeroport-orly': {
    slug: 'vtc-aeroport-orly',
    title: 'VTC Aéroport Orly',
    metaTitle: 'VTC Aéroport Orly — Transfert Paris-Orly | Owise',
    metaDesc: 'Transfert VTC vers l\'aéroport d\'Orly depuis Paris et IDF. Tarif fixe, chauffeur professionnel, disponible 24h/24. Réservation en ligne en 30 secondes.',
    keywords: ['vtc orly','transfert aéroport orly','chauffeur privé orly','taxi orly paris','vtc paris orly'],
    h1: 'VTC Aéroport d\'Orly (ORY)',
    intro: 'Transfert VTC vers Paris-Orly (ORY) dans les meilleures conditions. Chauffeur professionnel, véhicule haut de gamme, tarif fixe sans surprise.',
    prix: 'dès 50€',
    duree: '20–45 min selon votre départ',
    faq: [
      { q: 'Combien coûte un VTC de Paris vers Orly ?', a: 'Depuis Paris intramuros, le tarif est entre 50€ et 70€ selon le véhicule. Le prix est fixe et garanti dès la réservation. Obtenez votre estimation exacte en quelques secondes.' },
      { q: 'Mon chauffeur m\'attend-il à l\'arrivée à Orly ?', a: 'Oui, votre chauffeur vous attend dans le hall des arrivées avec une pancarte nominative. Le terminal (Orly 1, 2, 3 ou 4) est précisé dans votre confirmation.' },
      { q: 'Quelle est la durée du trajet Paris–Orly ?', a: 'Entre 20 et 45 minutes depuis Paris intramuros, selon la zone de départ et la circulation. Le matin tôt ou tard le soir, comptez 20–25 minutes.' },
      { q: 'Desservez-vous Orly depuis l\'Oise ou la banlieue ?', a: 'Oui. Nous desservons Orly depuis toute l\'Île-de-France et l\'Oise. Le tarif varie selon la distance — utilisez notre calculateur pour votre adresse.' },
    ],
  },
  'vtc-creil': {
    slug: 'vtc-creil',
    title: 'VTC Creil — Chantilly — Senlis',
    metaTitle: 'VTC Creil, Chantilly, Senlis → CDG Orly Paris | Owise',
    metaDesc: 'Chauffeur VTC depuis Creil, Chantilly, Senlis et l\'Oise Sud vers CDG, Orly et Paris. Tarif forfaitaire garanti. Disponible 24h/24. Réservez en ligne.',
    keywords: ['vtc creil','chauffeur privé creil cdg','vtc chantilly','vtc senlis aeroport','vtc oise cdg'],
    h1: 'VTC depuis Creil, Chantilly & Senlis',
    intro: 'Votre chauffeur VTC depuis Creil, Chantilly, Senlis, Nogent-sur-Oise et toute l\'Oise Sud vers CDG, Orly ou Paris. Tarif fixe, réservation en 30 secondes.',
    prix: 'dès 65€ vers CDG',
    duree: '35–50 min vers CDG',
    faq: [
      { q: 'Quel est le tarif depuis Creil vers CDG ?', a: 'Le forfait Creil → CDG est à partir de 75€ en berline. Le prix est fixe et garanti, quelle que soit la durée du trajet ou les conditions de circulation.' },
      { q: 'Desservez-vous Chantilly et Senlis ?', a: 'Oui. Nous couvrons toute l\'Oise Sud : Creil, Chantilly, Senlis, Nogent-sur-Oise, Pont-Sainte-Maxence, Lamorlaye, Gouvieux et toutes les communes alentour.' },
      { q: 'Puis-je réserver tôt le matin depuis l\'Oise ?', a: 'Absolument. Nous sommes disponibles 24h/24, 7j/7. Pour les départs très matinaux (avant 6h), le supplément nuit (+20%) s\'applique automatiquement.' },
      { q: 'Proposez-vous des courses Creil → Orly ?', a: 'Oui. Le forfait Creil → Orly est d\'environ 100€ en berline. Tous les aéroports parisiens (CDG, Orly, Beauvais) sont desservis depuis l\'Oise.' },
    ],
  },
  'vtc-chantilly': {
    slug: 'vtc-chantilly',
    title: 'VTC Chantilly — Aéroport & Paris',
    metaTitle: 'VTC Chantilly → CDG, Orly, Paris | Chauffeur Privé | Owise',
    metaDesc: 'VTC et chauffeur privé depuis Chantilly vers CDG, Orly et Paris. Tarif fixe, véhicule premium, disponible 24h/24. Idéal pour le Château de Chantilly et les événements.',
    keywords: ['vtc chantilly','chauffeur privé chantilly','vtc chantilly cdg','taxi chantilly aéroport','vtc chantilly paris'],
    h1: 'VTC Chantilly — Chauffeur Privé',
    intro: 'Chauffeur VTC depuis Chantilly et ses environs vers CDG, Orly, Paris et toute l\'Île-de-France. Idéal pour le Château de Chantilly, l\'hippodrome, les hôtels de luxe et les événements.',
    prix: 'dès 70€ vers CDG',
    duree: '40–55 min vers CDG',
    faq: [
      { q: 'Quel est le prix d\'un VTC Chantilly → CDG ?', a: 'Le forfait Chantilly → CDG est d\'environ 75€ en berline, prix fixe garanti. Obtenez votre estimation exacte avec notre calculateur en ligne.' },
      { q: 'Proposez-vous des transferts pour le Château de Chantilly ?', a: 'Oui. Nous sommes disponibles pour les événements privés, séminaires et visites du Château et du Domaine de Chantilly. Tarif sur devis pour les groupes.' },
      { q: 'Desservez-vous l\'hippodrome de Chantilly ?', a: 'Oui, pour les jours de course et les événements. Réservez à l\'avance, surtout pour le Prix de Diane et le Prix du Jockey Club.' },
      { q: 'Puis-je réserver un aller-retour Chantilly–Paris ?', a: 'Absolument. L\'option aller-retour est disponible dès la réservation avec un tarif préférentiel. Indiquez votre heure de retour souhaitée.' },
    ],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }): Promise<Metadata> {
  const { destination } = await params
  const dest = DESTINATIONS[destination]
  if (!dest) return {}
  const BASE = 'https://owise.fr'
  return {
    title: dest.metaTitle,
    description: dest.metaDesc,
    keywords: dest.keywords,
    alternates: { canonical: `${BASE}/${dest.slug}` },
    openGraph: {
      title: dest.metaTitle,
      description: dest.metaDesc,
      url: `${BASE}/${dest.slug}`,
      locale: 'fr_FR',
      siteName: 'Owise',
    },
  }
}

export function generateStaticParams() {
  return Object.keys(DESTINATIONS).map(slug => ({ destination: slug }))
}

export default async function DestinationPage({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params
  const dest = DESTINATIONS[destination]
  if (!dest) notFound()

  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code', 'HORS'),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: dest.title,
    description: dest.metaDesc,
    provider: { '@type': 'LocalBusiness', name: 'Owise', url: 'https://owise.fr', telephone: '+33619106356' },
    areaServed: { '@type': 'Country', name: 'FR' },
    offers: { '@type': 'Offer', priceCurrency: 'EUR', description: dest.prix },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Bandeau SEO discret au-dessus du hero */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
        background: 'rgba(9,9,26,0.97)', borderBottom: '1px solid rgba(201,168,76,.15)',
        padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(201,168,76,.8)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
            {dest.title}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(237,232,223,.35)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(237,232,223,.5)' }}>{dest.prix} · {dest.duree}</span>
        </div>
        <a href="/" style={{ fontSize: 11, color: 'rgba(201,168,76,.7)', textDecoration: 'none', letterSpacing: '.08em' }}>
          ← Accueil
        </a>
      </div>

      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} />

      {/* Section intro SEO */}
      <section style={{ background: '#fff', padding: '60px 24px', maxWidth: 860, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 500, color: '#0A0A0A', marginBottom: 16, lineHeight: 1.1 }}>
          {dest.h1}
        </h2>
        <p style={{ fontSize: 16, color: '#6B6B6B', lineHeight: 1.8, marginBottom: 32, maxWidth: 680 }}>
          {dest.intro}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { label: 'Prix', value: dest.prix },
            { label: 'Durée estimée', value: dest.duree },
            { label: 'Disponibilité', value: '24h/24 · 7j/7' },
          ].map((stat, i) => (
            <div key={i} style={{ background: '#F7F7F7', borderRadius: 12, padding: '20px 18px' }}>
              <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0A0A0A' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0A0A0A', marginBottom: 24 }}>
          Questions fréquentes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dest.faq.map((item, i) => (
            <div key={i} style={{ background: '#F7F7F7', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A', marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
