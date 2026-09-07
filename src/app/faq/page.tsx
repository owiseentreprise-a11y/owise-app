import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — Questions fréquentes VTC Owise',
  description: 'Toutes les réponses sur le service de chauffeur privé Owise : réservation, tarifs, zone de service, transferts aéroport, paiement, annulation.',
  alternates: { canonical: 'https://www.owise.fr/faq' },
  openGraph: {
    title: 'FAQ — Questions fréquentes VTC Owise',
    description: 'Réservation, tarifs, zone de service, transferts aéroport — toutes les réponses sur Owise, votre chauffeur privé dans l\'Oise et l\'Île-de-France.',
    url: 'https://www.owise.fr/faq',
  },
}

const BASE = 'https://www.owise.fr'

const faqs = [
  {
    q: "C'est quoi Owise ?",
    a: "Owise est une plateforme de chauffeur privé (VTC) disponible dans l'Oise et l'Île-de-France. Elle met en relation des clients particuliers et entreprises avec des chauffeurs professionnels habilités, pour des trajets à tarif fixe annoncé avant la réservation. Owise couvre notamment Chantilly, Creil, Senlis, Compiègne, Gouvieux, Lamorlaye, Nogent-sur-Oise et les transferts vers les aéroports CDG, Orly et Beauvais.",
  },
  {
    q: "Quelle est la différence entre un taxi et un VTC ?",
    a: "Un taxi peut prendre des passagers à la volée dans la rue et utilise un compteur. Un VTC (Véhicule de Transport avec Chauffeur) se réserve obligatoirement à l'avance, propose un tarif fixe connu avant le départ, et offre en général un niveau de confort supérieur. Owise propose les deux : des chauffeurs VTC et des taxis conventionnés, selon disponibilité.",
  },
  {
    q: "Comment réserver un VTC avec Owise ?",
    a: "La réservation se fait directement en ligne sur owise.fr/reserver. Vous renseignez votre adresse de départ, votre destination, la date et l'heure souhaitées. Le prix est estimé instantanément. Le paiement est sécurisé par carte bancaire via Stripe. Vous pouvez aussi payer en espèces, par chèque ou par virement pour les comptes professionnels.",
  },
  {
    q: "Combien coûte un VTC de Chantilly à Paris ?",
    a: "Le prix d'un trajet Chantilly–Paris varie selon l'adresse exacte de départ et d'arrivée, l'horaire et le type de véhicule choisi. Owise propose un estimateur de prix en temps réel sur owise.fr. À titre indicatif, un trajet depuis Chantilly vers Paris intramuros est proposé à tarif fixe, généralement entre 80 € et 130 € selon la destination précise dans Paris.",
  },
  {
    q: "Owise est-il disponible 24h/24 et 7j/7 ?",
    a: "Oui, Owise est disponible 24 heures sur 24, 7 jours sur 7, y compris les jours fériés. Des suppléments nuit et jours fériés peuvent s'appliquer selon les horaires — le tarif exact est toujours affiché avant la confirmation.",
  },
  {
    q: "Quels modes de paiement acceptez-vous ?",
    a: "Owise accepte le paiement par carte bancaire (Visa, Mastercard, American Express) via Stripe, en espèces directement au chauffeur, par chèque, et par virement bancaire pour les clients professionnels ayant un compte Owise Entreprise.",
  },
  {
    q: "Comment se déroule un transfert aéroport avec Owise ?",
    a: "Pour un transfert vers l'aéroport, vous réservez à l'avance sur owise.fr en indiquant votre adresse et votre terminal. Le chauffeur vous prend en charge à votre domicile et vous dépose au terminal souhaité. Pour un retour depuis l'aéroport, le chauffeur surveille votre vol en temps réel et s'adapte à tout retard sans frais supplémentaires.",
  },
  {
    q: "Les chauffeurs Owise sont-ils certifiés et habilités ?",
    a: "Oui, tous les chauffeurs partenaires d'Owise sont titulaires d'une carte professionnelle VTC ou d'une licence de taxi délivrée par les autorités compétentes. Owise est un intermédiaire réglementé au sens de l'article L. 3120-1 du Code des transports français.",
  },
  {
    q: "Puis-je annuler ma réservation ?",
    a: "Oui, vous pouvez annuler votre réservation. Les conditions d'annulation (gratuité ou frais) dépendent du délai avant la prise en charge. Les détails complets des conditions d'annulation sont disponibles dans les CGV sur owise.fr/mentions-legales.",
  },
  {
    q: "Quelle est la zone de service d'Owise ?",
    a: "Owise couvre l'Oise (Chantilly, Creil, Senlis, Compiègne, Gouvieux, Lamorlaye, Nogent-sur-Oise, Montataire, Clermont, Liancourt, Coye-la-Forêt, Orry-la-Ville, La Chapelle-en-Serval, Boran-sur-Oise, Précy-sur-Oise et tous les villages environnants), l'Île-de-France (Paris, Versailles, Pontoise, Cergy), ainsi que les liaisons vers les aéroports CDG, Orly et Beauvais.",
  },
  {
    q: "Owise propose-t-il des navettes ou shuttles pour groupes ?",
    a: "Oui, Owise propose des navettes privées (shuttles) pour les groupes, séminaires, événements d'entreprise et transferts collectifs. Différents types de véhicules sont disponibles : berline, berline premium, van 7 places et grand van. Pour une demande de groupe, vous pouvez effectuer une réservation via le formulaire en ligne ou contacter Owise directement.",
  },
  {
    q: "Combien de temps à l'avance faut-il réserver ?",
    a: "Owise accepte les réservations en avance (quelques jours ou semaines) comme les réservations de dernière minute. Pour les trajets aéroport aux heures de pointe ou pour les véhicules grande capacité, une réservation à l'avance est recommandée pour garantir la disponibilité.",
  },
  {
    q: "Owise propose-t-il du transport médical ou paramédical ?",
    a: "Owise propose du transport de personnes pour des trajets médicaux non urgents (consultations, hospitalisations, soins) dans l'Oise et l'Île-de-France. Ces trajets sont réservés via le formulaire standard sur owise.fr. Owise ne prend pas en charge le transport médicalisé d'urgence.",
  },
  {
    q: "Y a-t-il un supplément pour les bagages ?",
    a: "Non, les bagages standards sont inclus dans le tarif. Le prix affiché lors de la réservation est le prix final, sans supplément pour les bagages classiques (valises de voyage). Pour des volumes exceptionnels ou du matériel spécifique, précisez-le lors de la réservation.",
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F1', fontFamily: 'DM Sans, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <div style={{ background: '#09091A', padding: '48px 24px 40px', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ color: '#C9A84C', fontSize: 22, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>OWISE</div>
        </Link>
        <h1 style={{ color: '#EDE8DF', fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, margin: '0 0 12px' }}>
          Questions fréquentes
        </h1>
        <p style={{ color: '#848499', fontSize: 16, margin: 0 }}>
          Tout ce qu'il faut savoir sur votre chauffeur privé VTC dans l'Oise
        </p>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>
        {faqs.map(({ q, a }, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '24px 28px',
              marginBottom: 16,
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              borderLeft: '3px solid #C9A84C',
            }}
          >
            <h2 style={{ color: '#09091A', fontSize: 17, fontWeight: 600, margin: '0 0 10px', lineHeight: 1.4 }}>
              {q}
            </h2>
            <p style={{ color: '#444', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
              {a}
            </p>
          </div>
        ))}

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 40, padding: '32px 24px', background: '#09091A', borderRadius: 16 }}>
          <p style={{ color: '#848499', fontSize: 14, margin: '0 0 8px' }}>Vous avez d'autres questions ?</p>
          <p style={{ color: '#EDE8DF', fontSize: 18, fontWeight: 600, margin: '0 0 24px' }}>
            Réservez directement en ligne — tarif fixe, 24h/24
          </p>
          <Link
            href="/reserver"
            style={{
              display: 'inline-block',
              background: '#C9A84C',
              color: '#09091A',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 32px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Réserver un VTC
          </Link>
        </div>
      </div>
    </div>
  )
}
