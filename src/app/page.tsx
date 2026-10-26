import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import './vitrine.css'
import { IDENTITE_OWISE, ficheAvis, lireAvis } from '@/lib/identite-owise'

const BASE = 'https://www.owise.fr'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: 'Owise — Chauffeur Privé VTC · Paris, IDF & Oise',
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
    title: 'Owise — Chauffeur Privé VTC · Paris & IDF',
    description:
      "Chauffeurs professionnels, tarif fixe garanti, disponible 24h/24. Réservez votre VTC à Paris, en IDF et dans l'Oise.",
    locale: 'fr_FR',
    siteName: 'Owise',
    images: [{ url: `${BASE}/brand_assets/hero-paris-night.webp`, width: 1920, height: 1080, alt: 'Avenue des Champs-Élysées de nuit avec l\'Arc de Triomphe illuminé, Paris' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owise — Chauffeur Privé VTC',
    description: 'VTC haut de gamme à Paris. Tarif fixe, chauffeurs certifiés, disponible 24h/24.',
    images: [`${BASE}/brand_assets/hero-paris-night.webp`],
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
  // Nom, image, adresse, position, téléphone : une seule définition pour tout
  // le site, dans src/lib/identite-owise.ts.
  ...IDENTITE_OWISE,
  description: 'Service VTC de prestige à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Creil, Chantilly, Senlis, Compiègne.',
  url: BASE,
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
      // Ces quatre descriptions partent à Google. Elles annoncaient encore les
      // montants d'avant les corrections des etapes 37 a 49 : les cartes
      // visibles avaient ete corrigees, ce bloc-ci non. Trois d'entre elles
      // annoncaient MOINS que le prix reel — un client arrivait avec un prix en
      // tete plus bas que celui qu'il paierait.
      //
      // Chaque montant est un forfait de la grille, confirme par calculerPrix()
      // en berline : contrôle `verifier-offres-jsonld.mjs`.
      //
      // Deux regles tirees de l'erreur d'origine :
      //   — pas de « des » : ces offres nomment UN trajet precis, donc un prix
      //     exact, pas un minimum. « Oise → BVA des 40 € » promettait a tout un
      //     departement un prix qui n'existait nulle part (le vrai minimum, 59 €,
      //     part de Beauvais-VILLE, a 5 km de son propre aeroport ; depuis
      //     Compiegne le meme trajet vaut 139 €, soit 80 € d'ecart).
      //   — le vehicule est nomme : premium et van coutent 1,5x et 1,7x.
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport CDG', description: 'Paris → CDG 69 € en berline, tarif fixe' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport Orly', description: 'Paris → Orly 59 € en berline, tarif fixe' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport Beauvais-Tillé (BVA)', description: 'Creil → Beauvais-Tillé 69 € en berline, tarif fixe' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'VTC Creil → CDG', description: 'Creil → CDG 59 € en berline, tarif fixe' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Compte entreprise VTC', description: 'Facturation mensuelle, multi-collaborateurs' } },
    ],
  },
  sameAs: ['https://owise.fr', 'https://facebook.com/Owise.vtc', 'https://www.tiktok.com/@owise857'],
  // La note est ajoutee au rendu, depuis le compteur reel (voir plus bas).
}

const jsonLdWebSite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Owise',
  url: BASE,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/reserver?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

const jsonLdOrganization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  ...IDENTITE_OWISE,
  // L'entite juridique porte le nom court ; la fiche commerciale garde le nom
  // complet. L'ordre compte : ces deux lignes doivent rester apres le socle.
  name: 'Owise',
  legalName: 'Owise',
  url: BASE,
  sameAs: [
    'https://owise.fr',
    'https://www.owise.fr',
    'https://facebook.com/Owise.vtc',
    'https://www.tiktok.com/@owise857',
  ],
  description: 'Plateforme de chauffeur privé VTC — Oise, Île-de-France et Paris. Tarif fixe garanti, disponible 24h/24.',
}

export const revalidate = 3600

/**
 * Au-delà de cette longueur, l'annonce de prix d'une carte « Nos zones
 * desservies » passe sous le titre au lieu de se poser à côté. Mesuré le
 * 2026-10-20 : les 33 autres cartes annoncent au plus 18 caractères, le seuil
 * ne les touche donc pas.
 */
const LONGUEUR_PRIX_SUR_SA_LIGNE = 20

export default async function VitrinePage() {
  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }, { data: grille }, { data: params }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code','HORS').eq('active', true),
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,supplement_etape,tarif_pec_actif,tarif_frais_pec,supplement_bagages_actif,supplement_bagages_prix,supplement_panneau_actif,supplement_panneau_prix,supplement_animaux_actif,supplement_animaux_prix,supplement_siege_enfant_actif,supplement_siege_enfant_prix').single(),
  ])
  // Le nombre d'avis vient de la base, jamais du code : le site a annonce
  // « 5 avis » alors que la fiche Google en portait 7.
  const avis = await lireAvis(admin)
  const jsonLdAvecAvis = { ...jsonLd, aggregateRating: ficheAvis(avis.nombre, avis.note) }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdAvecAvis) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
      />
      {/* `palette="a"` : la palette A, sur l'accueil et nulle part ailleurs.
          Les 38 pages villes ne passent pas cette prop — voir VitrineBody. */}
      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} grille={grille ?? []} params={params} palette="a" />

      {/* Section maillage interne — server-rendered, visible par Google */}
      <section className="ed-section ed-claire" style={{ background: 'var(--ed-fond-clair)', padding: '64px 24px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 500, color: 'var(--ed-titre)', marginBottom: 8, textAlign: 'center' }}>
            Nos zones desservies
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--ed-texte-2)', fontSize: 15, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            Chauffeur privé disponible 24h/24 à Paris, en Île-de-France et dans l&apos;Oise. Tarif fixe garanti depuis votre adresse.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              /* Paris en tête : c'est le marché visé, et la page qui donne enfin
                 un point d'arrivée aux articles du blog qui parlent de Paris.
                 « dès 29 € » est le tarif Paris ↔ Paris de la grille, vérifié
                 le 2026-10-19 par calculerPrix() — comme tous les montants de
                 cette liste depuis les étapes 37 à 47. */
              { slug: 'vtc-paris',             title: 'VTC Paris',                     prix: 'dès 29€',  desc: 'Chauffeur privé Paris : aéroports, gares, mise à disposition' },
              { slug: 'vtc-aeroport-cdg',      title: 'VTC Aéroport CDG',              prix: 'dès 59€',  desc: 'Transfert Charles de Gaulle, suivi de vol' },
              { slug: 'vtc-aeroport-orly',     title: 'VTC Aéroport Orly',             prix: 'dès 59€',  desc: 'Transfert Paris-Orly, tous terminaux' },
              /* « dès 59€ » promettait ici le tarif Beauvais-ville → Beauvais-Tillé,
                 un trajet de 5 km, alors que la page d'arrivée facture 69 € depuis
                 Creil. L'accueil et la page se contredisaient : le visiteur cliquait
                 sur 59€ et trouvait 69 €.
                 L'espace entre 69 et € est INSÉCABLE (U+00A0), comme sur la page
                 destination — caractère invisible, signalé pour qu'une recherche
                 « 69 € » avec une espace ordinaire ne passe pas à côté.
                 « tarif fixe » n'y tient pas : mesuré le 2026-10-20, la mention porte
                 le prix à 276 px pour 314 px de ligne disponible, titre compris, et la
                 carte déborde. Ce span est en `nowrap` : un texte trop long ne se
                 replie pas, il pousse. */
              { slug: 'vtc-aeroport-beauvais', title: 'VTC Aéroport Beauvais-Tillé',   prix: 'Creil → Beauvais-Tillé : 69 € en berline',  desc: 'Hub Ryanair & Wizzair depuis l\'Oise' },
              { slug: 'vtc-creil',             title: 'VTC Creil & Oise Sud',           prix: 'dès 59€ vers CDG',  desc: 'Senlis, Chantilly, Lamorlaye, Saint-Maximin' },
              { slug: 'vtc-chantilly',         title: 'VTC Chantilly',                  prix: 'dès 59€',  desc: 'Château, Hippodrome, hôtels de prestige' },
              { slug: 'vtc-senlis',            title: 'VTC Senlis & Environs',          prix: 'dès 59€',  desc: 'Cité médiévale, Forêt de Chantilly' },
              { slug: 'vtc-gouvieux',          title: 'VTC Gouvieux & Lamorlaye',       prix: 'dès 59€',  desc: 'Coye-la-Forêt, Orry-la-Ville, Précy' },
              { slug: 'vtc-lamorlaye',         title: 'VTC Lamorlaye',                  prix: 'dès 59€',  desc: 'Forêt de Chantilly, Boran-sur-Oise' },
              { slug: 'vtc-compiegne',         title: 'VTC Compiègne',                  prix: 'dès 115€', desc: 'Margny, Venette, Oise Nord' },
              { slug: 'vtc-pontoise',          title: 'VTC Pontoise & Cergy',           prix: 'Prix selon adresse',  desc: 'Val-d\'Oise, Saint-Ouen-l\'Aumône' },
              { slug: 'vtc-versailles',        title: 'VTC Versailles & Yvelines',      prix: 'Prix selon adresse',  desc: 'Château, Vélizy, Saint-Quentin-en-Yvelines' },
              { slug: 'vtc-coye-la-foret',     title: 'VTC Coye-la-Forêt',             prix: 'dès 59€',  desc: 'Forêt de Chantilly, Lamorlaye, Orry-la-Ville' },
              { slug: 'vtc-orry-la-ville',     title: 'VTC Orry-la-Ville',             prix: 'dès 59€',  desc: 'Entre Chantilly et CDG, Mortefontaine' },
              { slug: 'vtc-la-chapelle-en-serval', title: 'VTC La Chapelle-en-Serval', prix: 'dès 59€',  desc: 'Proche A1, Mortefontaine, Plailly' },
              { slug: 'vtc-boran-sur-oise',    title: 'VTC Boran-sur-Oise',            prix: 'dès 59€',  desc: 'Vallée de l\'Oise, Précy, Mesnil-en-Thelle' },
              { slug: 'vtc-precy-sur-oise',    title: 'VTC Précy-sur-Oise',            prix: 'dès 59€',  desc: 'Oise Nord, Boran, Villeneuve-sur-Verberie' },
              { slug: 'vtc-luzarches',         title: 'VTC Luzarches',                 prix: 'dès 59€',  desc: 'Pays de France, Asnières-sur-Oise, Val-d\'Oise' },
              { slug: 'vtc-clermont',          title: 'VTC Clermont (Oise)',           prix: 'Prix selon adresse', desc: 'Clermontois, Agnetz, Breuil-le-Vert, Étouy' },
              { slug: 'vtc-liancourt',         title: 'VTC Liancourt · Rantigny',      prix: 'dès 59€', desc: 'Rantigny, Cauffry, Laigneville, Monchy-Saint-Éloi' },
              { slug: 'vtc-chambly',           title: 'VTC Chambly',                   prix: 'Prix selon adresse',  desc: 'Bornel, Balagny, Neuilly-en-Thelle — proche CDG' },
              { slug: 'vtc-meru',              title: 'VTC Méru · Oise Ouest',         prix: 'Prix selon adresse',  desc: 'Noailles, Saint-Crépin, Bornel — accès Beauvais 35 km' },
              { slug: 'vtc-verberie',          title: 'VTC Verberie',                  prix: 'Prix selon adresse',  desc: 'Longueil-Ste-Marie, Pont-Ste-Maxence, vallée de l\'Oise' },
              { slug: 'vtc-noyon',             title: 'VTC Noyon · Oise Nord',         prix: 'Prix selon adresse', desc: 'Ribécourt, Sempigny, Guiscard — CDG en 80–100 min' },
            ].map(d => {
              /* Une annonce longue passe sur SA PROPRE LIGNE, sous le titre.
                 Le prix est en `nowrap` : posé à côté du titre, un texte long
                 écrase d'abord le titre, puis atteint le bord de la carte.
                 Mesuré le 2026-10-20 : « Creil → Beauvais-Tillé : 69 € en
                 berline » demande 223 px quand la ligne n'en offre que 270 à
                 360 px, titre compris — seule carte sur 34 à déborder.
                 Le seuil porte sur la LONGUEUR, pas sur un slug : c'est elle
                 qui pose le problème. Les 33 autres cartes annoncent au plus
                 18 caractères (« Prix selon adresse »), aucune ne change donc
                 de rendu. La grille « Trajets Oise → Aéroports », plus bas,
                 garde son rendu d'origine : ses prix tiennent en 9 caractères. */
              const surSaLigne = d.prix.length > LONGUEUR_PRIX_SUR_SA_LIGNE
              return (
              <a key={d.slug} href={`/${d.slug}`} style={{ display: 'block', background: 'var(--ed-carte)', borderRadius: 12, padding: '20px 20px', textDecoration: 'none', border: '1px solid rgba(var(--ed-filet-rvb),.06)', transition: 'box-shadow .15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, ...(surSaLigne ? { flexWrap: 'wrap' as const } : {}) }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ed-titre)' }}>{d.title}</span>
                  <span style={surSaLigne
                    ? { fontSize: 12, fontWeight: 700, color: 'var(--ed-accent)', flexBasis: '100%', marginTop: 4 }
                    : { fontSize: 12, fontWeight: 700, color: 'var(--ed-accent)', whiteSpace: 'nowrap' as const, marginLeft: 8 }}>{d.prix}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ed-texte-2)', lineHeight: 1.5 }}>{d.desc}</span>
              </a>
              )
            })}
          </div>
          {/* Trajets Oise → Aéroports */}
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--ed-titre)', margin: '40px 0 16px', paddingTop: 32, borderTop: '1px solid rgba(var(--ed-filet-rvb),.06)' }}>
            Trajets Oise → Aéroports
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { slug: 'vtc-chantilly-cdg',     title: 'VTC Chantilly → CDG',       prix: '59€',      desc: 'Gouvieux, Lamorlaye — suivi de vol inclus' },
              { slug: 'vtc-creil-cdg',         title: 'VTC Creil → CDG',           prix: '59€',      desc: 'Nogent-sur-Oise, Montataire, 40–55 min via A1' },
              { slug: 'vtc-senlis-cdg',        title: 'VTC Senlis → CDG',          prix: '59€',  desc: 'Aumont-en-Halatte, Fleurines, 45–60 min' },
              { slug: 'vtc-compiegne-cdg',     title: 'VTC Compiègne → CDG',       prix: '115€', desc: 'Margny, Venette, 70–90 min via A1' },
              { slug: 'vtc-chantilly-orly',    title: 'VTC Chantilly → Orly',      prix: 'dès 139€', desc: 'Gouvieux, Lamorlaye, 60–80 min' },
              { slug: 'vtc-creil-orly',        title: 'VTC Creil → Orly',          prix: 'dès 145€', desc: 'Nogent-sur-Oise, Montataire, 65–85 min' },
              { slug: 'vtc-senlis-orly',       title: 'VTC Senlis → Orly',         prix: '139€', desc: 'Aumont-en-Halatte, Fleurines, 70–90 min' },
              { slug: 'vtc-compiegne-orly',    title: 'VTC Compiègne → Orly',      prix: '149€', desc: 'Margny, Venette, 80–100 min' },
              { slug: 'vtc-chantilly-beauvais',title: 'VTC Chantilly → Beauvais-Tillé',  prix: '79€',  desc: 'Hub Ryanair, 40–55 min sans traverser Paris' },
              { slug: 'vtc-creil-beauvais',    title: 'VTC Creil → Beauvais-Tillé',      prix: '69€',  desc: 'Nogent, Montataire — hub Ryanair & Wizzair' },
            ].map(d => (
              <a key={d.slug} href={`/${d.slug}`} style={{ display: 'block', background: 'var(--ed-carte)', borderRadius: 12, padding: '20px 20px', textDecoration: 'none', border: '1px solid rgba(var(--ed-filet-rvb),.06)', transition: 'box-shadow .15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ed-titre)' }}>{d.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ed-accent)', whiteSpace: 'nowrap', marginLeft: 8 }}>{d.prix}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ed-texte-2)', lineHeight: 1.5 }}>{d.desc}</span>
              </a>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/blog" style={{ fontSize: 13, color: 'var(--ed-accent)', textDecoration: 'none', fontWeight: 500 }}>
              Voir nos guides et conseils VTC →
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
