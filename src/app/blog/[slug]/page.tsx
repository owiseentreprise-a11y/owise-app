import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const DESTINATIONS: Record<string, { label: string; href: string }[]> = {
  // ── Chantilly hub ──
  'vtc-chantilly-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Chantilly', href: '/blog/vtc-chantilly-orly' },
    { label: '→ Beauvais depuis Chantilly', href: '/blog/vtc-chantilly-beauvais' },
    { label: 'Départ de nuit CDG', href: '/blog/vtc-chantilly-nuit-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
  ],
  'vtc-chantilly-orly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ Beauvais depuis Chantilly', href: '/blog/vtc-chantilly-beauvais' },
  ],
  'vtc-chantilly-beauvais': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'VTC Aéroport Beauvais', href: '/vtc-aeroport-beauvais' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ Orly depuis Chantilly', href: '/blog/vtc-chantilly-orly' },
  ],
  'vtc-chantilly-nuit-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
    { label: 'VTC pas cher Chantilly', href: '/blog/vtc-chantilly-pas-cher-cdg' },
  ],
  'vtc-chantilly-cdg-avis': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
  ],
  'vtc-chantilly-cdg-groupe-famille': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Van Chantilly CDG', href: '/blog/vtc-van-chantilly-cdg' },
    { label: 'Guide vacances Oise CDG', href: '/blog/vtc-oise-cdg-noel-vacances' },
  ],
  'vtc-chantilly-pas-cher-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
  ],
  // ── Creil hub ──
  'vtc-creil-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Creil', href: '/blog/vtc-creil-orly' },
    { label: '→ Beauvais depuis Creil', href: '/blog/vtc-creil-beauvais' },
    { label: 'Creil → Paris', href: '/blog/vtc-creil-paris' },
  ],
  'vtc-creil-orly': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: '→ Beauvais depuis Creil', href: '/blog/vtc-creil-beauvais' },
  ],
  'vtc-creil-beauvais': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport Beauvais', href: '/vtc-aeroport-beauvais' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: '→ Orly depuis Creil', href: '/blog/vtc-creil-orly' },
  ],
  'vtc-creil-paris': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Paris → Creil', href: '/blog/vtc-paris-creil' },
    { label: 'Avis clients Creil CDG', href: '/blog/vtc-creil-cdg-avis' },
  ],
  'vtc-creil-cdg-avis': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Meilleur VTC Creil', href: '/blog/meilleur-vtc-creil' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
  ],
  // ── Senlis hub ──
  'vtc-senlis-cdg': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Senlis', href: '/blog/vtc-senlis-orly' },
    { label: '→ Beauvais depuis Senlis', href: '/blog/vtc-senlis-beauvais' },
    { label: 'Senlis → Paris', href: '/blog/vtc-senlis-paris' },
  ],
  'vtc-senlis-orly': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: '→ Beauvais depuis Senlis', href: '/blog/vtc-senlis-beauvais' },
  ],
  'vtc-senlis-beauvais': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: 'VTC Aéroport Beauvais', href: '/vtc-aeroport-beauvais' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: '→ Orly depuis Senlis', href: '/blog/vtc-senlis-orly' },
  ],
  'vtc-senlis-paris': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Paris → Senlis', href: '/blog/vtc-paris-senlis' },
    { label: 'Van Senlis CDG', href: '/blog/vtc-van-senlis-cdg' },
  ],
  // ── Gouvieux hub ──
  'vtc-gouvieux-cdg': [
    { label: 'VTC Gouvieux', href: '/vtc-gouvieux' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Gouvieux', href: '/blog/vtc-gouvieux-orly' },
    { label: 'Gouvieux → Paris', href: '/blog/vtc-gouvieux-paris' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
  ],
  'vtc-gouvieux-orly': [
    { label: 'VTC Gouvieux', href: '/vtc-gouvieux' },
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Gouvieux', href: '/blog/vtc-gouvieux-cdg' },
    { label: '→ Orly depuis Chantilly', href: '/blog/vtc-chantilly-orly' },
  ],
  'vtc-gouvieux-paris': [
    { label: 'VTC Gouvieux', href: '/vtc-gouvieux' },
    { label: '→ CDG depuis Gouvieux', href: '/blog/vtc-gouvieux-cdg' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
  ],
  // ── Lamorlaye hub ──
  'vtc-lamorlaye-cdg': [
    { label: 'VTC Lamorlaye', href: '/vtc-lamorlaye' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ CDG depuis Gouvieux', href: '/blog/vtc-gouvieux-cdg' },
    { label: 'Coye-la-Forêt CDG', href: '/blog/vtc-coye-la-foret-cdg' },
  ],
  // ── Compiègne hub ──
  'vtc-compiegne-cdg': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Compiègne', href: '/blog/vtc-compiegne-orly' },
    { label: '→ Beauvais depuis Compiègne', href: '/blog/vtc-compiegne-beauvais' },
    { label: 'Compiègne → Paris', href: '/blog/vtc-compiegne-paris' },
  ],
  'vtc-compiegne-orly': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: '→ Beauvais depuis Compiègne', href: '/blog/vtc-compiegne-beauvais' },
  ],
  'vtc-compiegne-beauvais': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: 'VTC Aéroport Beauvais', href: '/vtc-aeroport-beauvais' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: '→ Orly depuis Compiègne', href: '/blog/vtc-compiegne-orly' },
  ],
  'vtc-compiegne-paris': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Van Compiègne CDG', href: '/blog/vtc-van-compiegne-cdg' },
    { label: 'Guide Forêt de Compiègne', href: '/blog/guide-transport-foret-de-compiegne' },
  ],
  // ── Villages Oise → CDG ──
  'vtc-nogent-sur-oise-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Montataire CDG', href: '/blog/vtc-montataire-cdg' },
  ],
  'vtc-montataire-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Nogent-sur-Oise CDG', href: '/blog/vtc-nogent-sur-oise-cdg' },
  ],
  'vtc-saint-maximin-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
  ],
  'vtc-pont-sainte-maxence-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
  ],
  'vtc-coye-la-foret-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ CDG depuis Lamorlaye', href: '/blog/vtc-lamorlaye-cdg' },
    { label: 'Orry-la-Ville CDG', href: '/blog/vtc-orry-la-ville-cdg' },
  ],
  'vtc-clermont-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Liancourt CDG', href: '/blog/vtc-liancourt-cdg' },
  ],
  'vtc-liancourt-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Clermont CDG', href: '/blog/vtc-clermont-cdg' },
  ],
  'vtc-orry-la-ville-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'La Chapelle-en-Serval CDG', href: '/blog/vtc-la-chapelle-en-serval-cdg' },
    { label: 'Coye-la-Forêt CDG', href: '/blog/vtc-coye-la-foret-cdg' },
  ],
  'vtc-la-chapelle-en-serval-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Orry-la-Ville CDG', href: '/blog/vtc-orry-la-ville-cdg' },
  ],
  // ── Paris → Oise ──
  'vtc-paris-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'CDG → Chantilly', href: '/blog/vtc-cdg-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Paris → Senlis', href: '/blog/vtc-paris-senlis' },
  ],
  'vtc-paris-creil': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Creil → Paris', href: '/blog/vtc-creil-paris' },
  ],
  'vtc-paris-senlis': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Senlis → Paris', href: '/blog/vtc-senlis-paris' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
  ],
  'vtc-cdg-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-cdg-paris': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Orly → Paris', href: '/blog/vtc-orly-paris' },
    { label: 'CDG → Chantilly', href: '/blog/vtc-cdg-chantilly' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
  ],
  'vtc-orly-paris': [
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: '→ Orly depuis Chantilly', href: '/blog/vtc-chantilly-orly' },
  ],
  // ── Paris arrondissements → CDG ──
  'vtc-paris-15-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
  ],
  'vtc-paris-18-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 15e CDG', href: '/blog/vtc-paris-15-cdg' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
  ],
  'vtc-paris-19-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
    { label: 'Paris centre CDG', href: '/blog/vtc-paris-2-cdg' },
  ],
  'vtc-paris-2-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
  ],
  // ── Guides événements ──
  'guide-transport-hippodrome-de-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Guide Château de Chantilly', href: '/blog/guide-transport-chateau-de-chantilly' },
    { label: 'Guide Prix de Diane', href: '/blog/guide-transport-prix-de-diane-longines' },
    { label: 'Guide Prix du Jockey Club', href: '/blog/guide-transport-prix-du-jockey-club' },
  ],
  'guide-transport-chateau-de-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Guide Hippodrome', href: '/blog/guide-transport-hippodrome-de-chantilly' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
  ],
  'guide-transport-prix-de-diane-longines': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'Guide Hippodrome', href: '/blog/guide-transport-hippodrome-de-chantilly' },
    { label: 'Guide Prix du Jockey Club', href: '/blog/guide-transport-prix-du-jockey-club' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
  ],
  'guide-transport-prix-du-jockey-club': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'Guide Hippodrome', href: '/blog/guide-transport-hippodrome-de-chantilly' },
    { label: 'Guide Prix de Diane', href: '/blog/guide-transport-prix-de-diane-longines' },
    { label: 'Van Chantilly CDG', href: '/blog/vtc-van-chantilly-cdg' },
  ],
  'guide-transport-foret-de-compiegne': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Compiègne → Paris', href: '/blog/vtc-compiegne-paris' },
  ],
  'guide-transport-vieille-ville-de-senlis': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Senlis → Paris', href: '/blog/vtc-senlis-paris' },
    { label: 'Paris → Senlis', href: '/blog/vtc-paris-senlis' },
  ],
  // ── Comparatifs & guides pratiques ──
  'taxi-vs-vtc-chantilly-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
    { label: 'VTC pas cher Chantilly', href: '/blog/vtc-chantilly-pas-cher-cdg' },
  ],
  'meilleur-vtc-oise-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
  ],
  'meilleur-vtc-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
    { label: 'Avis clients Chantilly CDG', href: '/blog/vtc-chantilly-cdg-avis' },
  ],
  'meilleur-vtc-creil': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
    { label: 'Avis clients Creil CDG', href: '/blog/vtc-creil-cdg-avis' },
  ],
  'vtc-oise-cdg-noel-vacances': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Guide famille Chantilly CDG', href: '/blog/vtc-chantilly-cdg-groupe-famille' },
    { label: 'Réservation anticipée CDG', href: '/blog/vtc-reservation-anticipee-cdg' },
  ],
  'vtc-reservation-anticipee-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Guide vacances Oise CDG', href: '/blog/vtc-oise-cdg-noel-vacances' },
    { label: 'Retard vol CDG', href: '/blog/vtc-retard-vol-cdg' },
  ],
  'vtc-retard-vol-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Réservation anticipée CDG', href: '/blog/vtc-reservation-anticipee-cdg' },
    { label: 'Terminaux CDG guide', href: '/blog/vtc-terminal-cdg' },
  ],
  'vtc-terminal-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Retard vol CDG', href: '/blog/vtc-retard-vol-cdg' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
  ],
  // ── Vans & entreprises ──
  'vtc-van-chantilly-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Van Creil CDG', href: '/blog/vtc-van-creil-cdg' },
    { label: 'Guide famille Chantilly CDG', href: '/blog/vtc-chantilly-cdg-groupe-famille' },
  ],
  'vtc-van-creil-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Van Chantilly CDG', href: '/blog/vtc-van-chantilly-cdg' },
    { label: 'Van Senlis CDG', href: '/blog/vtc-van-senlis-cdg' },
  ],
  'vtc-van-senlis-cdg': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Van Creil CDG', href: '/blog/vtc-van-creil-cdg' },
    { label: 'Van Compiègne CDG', href: '/blog/vtc-van-compiegne-cdg' },
  ],
  'vtc-van-compiegne-cdg': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Van Creil CDG', href: '/blog/vtc-van-creil-cdg' },
    { label: 'Van Senlis CDG', href: '/blog/vtc-van-senlis-cdg' },
  ],
  'vtc-entreprise-chantilly-cdg': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Entreprise Creil CDG', href: '/blog/vtc-entreprise-creil-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
  ],
  'vtc-entreprise-creil-cdg': [
    { label: 'VTC Creil & Oise Sud', href: '/vtc-creil' },
    { label: '→ CDG depuis Creil', href: '/blog/vtc-creil-cdg' },
    { label: 'Entreprise Chantilly CDG', href: '/blog/vtc-entreprise-chantilly-cdg' },
  ],
  // ── Alternatives Uber ──
  'vtc-uber-alternative-chantilly': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
    { label: 'Alternative Uber Oise CDG', href: '/blog/vtc-uber-alternative-cdg-oise' },
  ],
  'vtc-uber-alternative-cdg-oise': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
    { label: 'Alternative Uber Chantilly', href: '/blog/vtc-uber-alternative-chantilly' },
    { label: 'Taxi vs VTC Chantilly', href: '/blog/taxi-vs-vtc-chantilly-cdg' },
  ],
  // ── Paris arrondissements vague 5 ──
  'vtc-paris-1-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 2e/3e/4e CDG', href: '/blog/vtc-paris-2-cdg' },
    { label: 'Paris 9e CDG', href: '/blog/vtc-paris-9-cdg' },
  ],
  'vtc-paris-5-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 7e CDG', href: '/blog/vtc-paris-7-cdg' },
    { label: 'Paris 14e/13e CDG', href: '/blog/vtc-paris-13-cdg' },
  ],
  'vtc-paris-7-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 8e CDG', href: '/blog/vtc-paris-8-cdg' },
    { label: 'Paris 15e CDG', href: '/blog/vtc-paris-15-cdg' },
    { label: 'Paris 5e/6e CDG', href: '/blog/vtc-paris-5-cdg' },
  ],
  'vtc-paris-8-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 17e CDG', href: '/blog/vtc-paris-17-cdg' },
    { label: 'Paris 16e CDG', href: '/blog/vtc-paris-16-cdg' },
    { label: 'La Défense CDG', href: '/blog/vtc-la-defense-cdg' },
  ],
  'vtc-paris-9-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
    { label: 'Paris 10e CDG', href: '/blog/vtc-paris-10-cdg' },
    { label: 'Paris 1er CDG', href: '/blog/vtc-paris-1-cdg' },
  ],
  'vtc-paris-10-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
    { label: 'Paris 9e CDG', href: '/blog/vtc-paris-9-cdg' },
  ],
  'vtc-paris-11-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 20e CDG', href: '/blog/vtc-paris-20-cdg' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
  ],
  'vtc-paris-13-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 15e CDG', href: '/blog/vtc-paris-15-cdg' },
    { label: 'Paris 5e/6e CDG', href: '/blog/vtc-paris-5-cdg' },
  ],
  'vtc-paris-16-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 17e CDG', href: '/blog/vtc-paris-17-cdg' },
    { label: 'Paris 8e CDG', href: '/blog/vtc-paris-8-cdg' },
    { label: 'Paris 15e CDG', href: '/blog/vtc-paris-15-cdg' },
  ],
  'vtc-paris-17-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 18e CDG', href: '/blog/vtc-paris-18-cdg' },
    { label: 'Paris 8e CDG', href: '/blog/vtc-paris-8-cdg' },
    { label: 'La Défense CDG', href: '/blog/vtc-la-defense-cdg' },
  ],
  'vtc-paris-20-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 19e CDG', href: '/blog/vtc-paris-19-cdg' },
    { label: 'Paris 11e/12e CDG', href: '/blog/vtc-paris-11-cdg' },
  ],
  'vtc-la-defense-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'Paris 17e CDG', href: '/blog/vtc-paris-17-cdg' },
    { label: 'Paris 8e CDG', href: '/blog/vtc-paris-8-cdg' },
    { label: 'Entreprise Chantilly CDG', href: '/blog/vtc-entreprise-chantilly-cdg' },
  ],
  // ── Vague 6 : Val-d'Oise & communes CDG ──
  'vtc-cergy-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'VTC Pontoise', href: '/vtc-pontoise' },
    { label: 'Pontoise CDG', href: '/blog/vtc-pontoise-cdg' },
    { label: 'Herblay CDG', href: '/blog/vtc-herblay-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-pontoise-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'VTC Pontoise', href: '/vtc-pontoise' },
    { label: 'Cergy CDG', href: '/blog/vtc-cergy-cdg' },
    { label: 'Herblay CDG', href: '/blog/vtc-herblay-cdg' },
  ],
  'vtc-herblay-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Cergy CDG', href: '/blog/vtc-cergy-cdg' },
    { label: 'Sarcelles CDG', href: '/blog/vtc-sarcelles-cdg' },
    { label: 'Gonesse CDG', href: '/blog/vtc-gonesse-cdg' },
  ],
  'vtc-sarcelles-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Gonesse CDG', href: '/blog/vtc-gonesse-cdg' },
    { label: 'Villepinte CDG', href: '/blog/vtc-villepinte-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-roissy-paris': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
    { label: 'CDG → Chantilly', href: '/blog/vtc-cdg-chantilly' },
    { label: 'Gonesse CDG', href: '/blog/vtc-gonesse-cdg' },
  ],
  'vtc-villepinte-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Gonesse CDG', href: '/blog/vtc-gonesse-cdg' },
    { label: 'Sarcelles CDG', href: '/blog/vtc-sarcelles-cdg' },
    { label: 'Roissy → Paris', href: '/blog/vtc-roissy-paris' },
    { label: 'Entreprise Chantilly CDG', href: '/blog/vtc-entreprise-chantilly-cdg' },
  ],
  'vtc-gonesse-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Villepinte CDG', href: '/blog/vtc-villepinte-cdg' },
    { label: 'Sarcelles CDG', href: '/blog/vtc-sarcelles-cdg' },
    { label: 'Roissy → Paris', href: '/blog/vtc-roissy-paris' },
  ],
  'vtc-versailles-cdg': [
    { label: 'VTC Versailles', href: '/vtc-versailles' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Paris 16e CDG', href: '/blog/vtc-paris-16-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-compiegne-cdg-avis': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Meilleur VTC Compiègne', href: '/blog/meilleur-vtc-compiegne' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
  ],
  'meilleur-vtc-senlis': [
    { label: 'VTC Senlis', href: '/vtc-senlis' },
    { label: '→ CDG depuis Senlis', href: '/blog/vtc-senlis-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
    { label: 'Avis Owise Chantilly CDG', href: '/blog/vtc-chantilly-cdg-avis' },
  ],
  'meilleur-vtc-compiegne': [
    { label: 'VTC Compiègne', href: '/vtc-compiegne' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Meilleur VTC Oise CDG', href: '/blog/meilleur-vtc-oise-cdg' },
    { label: 'Avis Owise Compiègne CDG', href: '/blog/vtc-compiegne-cdg-avis' },
  ],
  // ── Vague 7 : Disneyland, Seine-et-Marne, guides thématiques ──
  'vtc-marne-la-vallee-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ Orly depuis Disneyland', href: '/blog/vtc-marne-la-vallee-orly' },
    { label: 'Meaux CDG', href: '/blog/vtc-meaux-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-marne-la-vallee-orly': [
    { label: 'VTC Aéroport Orly', href: '/vtc-aeroport-orly' },
    { label: '→ CDG depuis Disneyland', href: '/blog/vtc-marne-la-vallee-cdg' },
    { label: 'Orly → Paris', href: '/blog/vtc-orly-paris' },
  ],
  'vtc-meaux-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Marne-la-Vallée CDG', href: '/blog/vtc-marne-la-vallee-cdg' },
    { label: 'Villepinte CDG', href: '/blog/vtc-villepinte-cdg' },
    { label: 'CDG → Paris', href: '/blog/vtc-cdg-paris' },
  ],
  'vtc-fontainebleau-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Versailles CDG', href: '/blog/vtc-versailles-cdg' },
    { label: 'Saint-Quentin-en-Yvelines CDG', href: '/blog/vtc-saint-quentin-en-yvelines-cdg' },
  ],
  'vtc-noyon-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: '→ CDG depuis Compiègne', href: '/blog/vtc-compiegne-cdg' },
    { label: 'Meilleur VTC Compiègne', href: '/blog/meilleur-vtc-compiegne' },
  ],
  'vtc-saint-quentin-en-yvelines-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Versailles CDG', href: '/blog/vtc-versailles-cdg' },
    { label: 'La Défense CDG', href: '/blog/vtc-la-defense-cdg' },
    { label: 'Paris 16e CDG', href: '/blog/vtc-paris-16-cdg' },
  ],
  'vtc-mariage-oise': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'Van Chantilly CDG', href: '/blog/vtc-van-chantilly-cdg' },
    { label: 'Transport groupe Oise CDG', href: '/blog/vtc-groupe-oise-cdg' },
    { label: 'Guide Château de Chantilly', href: '/blog/guide-transport-chateau-de-chantilly' },
  ],
  'vtc-soiree-paris-oise': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'Départ de nuit CDG', href: '/blog/vtc-chantilly-nuit-cdg' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
    { label: 'Paris → Creil', href: '/blog/vtc-paris-creil' },
  ],
  'vtc-medical-oise-paris': [
    { label: 'VTC Chantilly', href: '/vtc-chantilly' },
    { label: 'Chantilly → Paris', href: '/blog/vtc-gouvieux-paris' },
    { label: 'Creil → Paris', href: '/blog/vtc-creil-paris' },
    { label: 'Senlis → Paris', href: '/blog/vtc-senlis-paris' },
  ],
  'vtc-groupe-oise-cdg': [
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
    { label: 'Van Chantilly CDG', href: '/blog/vtc-van-chantilly-cdg' },
    { label: 'Van Creil CDG', href: '/blog/vtc-van-creil-cdg' },
    { label: 'VTC mariage Oise', href: '/blog/vtc-mariage-oise' },
    { label: 'Guide famille Chantilly CDG', href: '/blog/vtc-chantilly-cdg-groupe-famille' },
  ],
  // ── Vague 8 — Longue distance ──
  'vtc-longue-distance-guide': [
    { label: 'VTC CDG Province', href: '/blog/vtc-cdg-province' },
    { label: 'Paris → Bruxelles', href: '/blog/vtc-paris-bruxelles' },
    { label: 'Paris → Lyon', href: '/blog/vtc-paris-lyon' },
    { label: 'Paris → Normandie', href: '/blog/vtc-paris-normandie' },
    { label: 'Paris → Lille', href: '/blog/vtc-paris-lille' },
    { label: 'Paris → Reims', href: '/blog/vtc-paris-reims' },
  ],
  'vtc-paris-lille': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'Paris → Bruxelles', href: '/blog/vtc-paris-bruxelles' },
    { label: 'Paris → Amiens', href: '/blog/vtc-paris-amiens' },
    { label: 'CDG → Bruxelles', href: '/blog/vtc-cdg-bruxelles' },
  ],
  'vtc-paris-lyon': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'CDG → Lyon', href: '/blog/vtc-cdg-lyon' },
    { label: 'Paris → Bordeaux', href: '/blog/vtc-oise-bordeaux' },
    { label: 'Paris → Normandie', href: '/blog/vtc-paris-normandie' },
  ],
  'vtc-paris-normandie': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
    { label: 'Paris → Bruxelles', href: '/blog/vtc-paris-bruxelles' },
    { label: 'Paris → Amiens', href: '/blog/vtc-paris-amiens' },
  ],
  'vtc-paris-bruxelles': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'CDG → Bruxelles', href: '/blog/vtc-cdg-bruxelles' },
    { label: 'Paris → Lille', href: '/blog/vtc-paris-lille' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
  ],
  'vtc-cdg-lyon': [
    { label: 'Paris → Lyon', href: '/blog/vtc-paris-lyon' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
  ],
  'vtc-cdg-province': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'CDG → Lyon', href: '/blog/vtc-cdg-lyon' },
    { label: 'CDG → Bruxelles', href: '/blog/vtc-cdg-bruxelles' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
  ],
  'vtc-oise-bordeaux': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'Paris → Lyon', href: '/blog/vtc-paris-lyon' },
    { label: 'Paris → Normandie', href: '/blog/vtc-paris-normandie' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
  ],
  'vtc-oise-strasbourg': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'Paris → Reims', href: '/blog/vtc-paris-reims' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
    { label: 'Paris → Lyon', href: '/blog/vtc-paris-lyon' },
  ],
  'vtc-paris-reims': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'Paris → Amiens', href: '/blog/vtc-paris-amiens' },
    { label: 'Paris → Strasbourg', href: '/blog/vtc-oise-strasbourg' },
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
  ],
  'vtc-paris-amiens': [
    { label: 'Guide longue distance', href: '/blog/vtc-longue-distance-guide' },
    { label: 'Paris → Lille', href: '/blog/vtc-paris-lille' },
    { label: 'Paris → Normandie', href: '/blog/vtc-paris-normandie' },
    { label: 'Paris → Reims', href: '/blog/vtc-paris-reims' },
  ],
  'vtc-cdg-bruxelles': [
    { label: 'CDG Province', href: '/blog/vtc-cdg-province' },
    { label: 'Paris → Bruxelles', href: '/blog/vtc-paris-bruxelles' },
    { label: 'Paris → Lille', href: '/blog/vtc-paris-lille' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
  ],
  // ── Vague 9 — Assurance, assistance, médical, B2B ──
  'vtc-remplacement-vehicule-assurance': [
    { label: 'VTC assistance routière', href: '/blog/vtc-assistance-routiere' },
    { label: 'VTC entreprise B2B', href: '/blog/vtc-entreprise-compte-b2b' },
    { label: 'VTC médical Oise→Paris', href: '/blog/vtc-medical-oise-paris' },
    { label: 'VTC Chantilly CDG', href: '/blog/vtc-chantilly-cdg' },
  ],
  'vtc-assistance-routiere': [
    { label: 'VTC remplacement véhicule assurance', href: '/blog/vtc-remplacement-vehicule-assurance' },
    { label: 'VTC nuit Chantilly CDG', href: '/blog/vtc-chantilly-nuit-cdg' },
    { label: 'VTC entreprise B2B', href: '/blog/vtc-entreprise-compte-b2b' },
  ],
  'vtc-dialyse-chimio-rdv-medical': [
    { label: 'VTC médical Oise→Paris', href: '/blog/vtc-medical-oise-paris' },
    { label: 'VTC sortie hôpital', href: '/blog/vtc-sortie-hopital-convalescence' },
    { label: 'VTC personnes âgées', href: '/blog/vtc-personnes-agees-mobilite' },
    { label: 'VTC PMR Oise', href: '/blog/vtc-pmr-handicap-oise' },
  ],
  'vtc-personnes-agees-mobilite': [
    { label: 'VTC dialyse/chimio', href: '/blog/vtc-dialyse-chimio-rdv-medical' },
    { label: 'VTC sortie hôpital', href: '/blog/vtc-sortie-hopital-convalescence' },
    { label: 'VTC PMR Oise', href: '/blog/vtc-pmr-handicap-oise' },
    { label: 'VTC Chantilly CDG', href: '/blog/vtc-chantilly-cdg' },
  ],
  'vtc-pmr-handicap-oise': [
    { label: 'VTC personnes âgées', href: '/blog/vtc-personnes-agees-mobilite' },
    { label: 'VTC dialyse/chimio', href: '/blog/vtc-dialyse-chimio-rdv-medical' },
    { label: 'VTC médical Oise→Paris', href: '/blog/vtc-medical-oise-paris' },
    { label: 'VTC Aéroport CDG', href: '/vtc-aeroport-cdg' },
  ],
  'vtc-conducteur-designe-oise': [
    { label: 'VTC soirée Paris→Oise', href: '/blog/vtc-soiree-paris-oise' },
    { label: 'VTC mariage Oise', href: '/blog/vtc-mariage-oise' },
    { label: 'VTC nuit Chantilly CDG', href: '/blog/vtc-chantilly-nuit-cdg' },
    { label: 'Van groupe Oise CDG', href: '/blog/vtc-groupe-oise-cdg' },
  ],
  'vtc-entreprise-compte-b2b': [
    { label: 'VTC séminaire entreprise', href: '/blog/vtc-seminaire-evenement-entreprise' },
    { label: 'VTC remplacement assurance', href: '/blog/vtc-remplacement-vehicule-assurance' },
    { label: 'VTC abonnement Oise-Paris', href: '/blog/vtc-teletravail-abonnement-oise-paris' },
    { label: 'VTC La Défense CDG', href: '/blog/vtc-la-defense-cdg' },
  ],
  'vtc-sortie-hopital-convalescence': [
    { label: 'VTC médical Oise→Paris', href: '/blog/vtc-medical-oise-paris' },
    { label: 'VTC dialyse/chimio', href: '/blog/vtc-dialyse-chimio-rdv-medical' },
    { label: 'VTC personnes âgées', href: '/blog/vtc-personnes-agees-mobilite' },
  ],
  'vtc-seminaire-evenement-entreprise': [
    { label: 'VTC entreprise B2B', href: '/blog/vtc-entreprise-compte-b2b' },
    { label: 'VTC mariage Oise', href: '/blog/vtc-mariage-oise' },
    { label: 'Van groupe Oise CDG', href: '/blog/vtc-groupe-oise-cdg' },
    { label: 'Guide Château de Chantilly', href: '/blog/guide-transport-chateau-de-chantilly' },
  ],
  'vtc-transport-scolaire-oise': [
    { label: 'VTC famille Chantilly CDG', href: '/blog/vtc-chantilly-cdg-groupe-famille' },
    { label: 'VTC abonnement Oise-Paris', href: '/blog/vtc-teletravail-abonnement-oise-paris' },
    { label: 'VTC personnes âgées', href: '/blog/vtc-personnes-agees-mobilite' },
  ],
  'vtc-teletravail-abonnement-oise-paris': [
    { label: 'VTC entreprise B2B', href: '/blog/vtc-entreprise-compte-b2b' },
    { label: 'VTC transport scolaire Oise', href: '/blog/vtc-transport-scolaire-oise' },
    { label: '→ CDG depuis Chantilly', href: '/blog/vtc-chantilly-cdg' },
    { label: 'Paris → Chantilly', href: '/blog/vtc-paris-chantilly' },
  ],
}

export const revalidate = 3600

export async function generateStaticParams() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('statut', 'publie')
      .limit(100)
    return (data ?? []).map(p => ({ slug: p.slug }))
  } catch {
    return []
  }
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('titre, meta_titre, meta_desc')
    .eq('slug', slug).eq('statut', 'publie').single()
  if (!data) return {}
  return {
    title: data.meta_titre,
    description: data.meta_desc,
    alternates: { canonical: `https://www.owise.fr/blog/${slug}` },
    openGraph: { title: data.meta_titre, description: data.meta_desc, url: `https://www.owise.fr/blog/${slug}`, siteName: 'Owise' },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug).eq('statut', 'publie').single()

  if (!post) notFound()

  const paragraphes: { titre: string; texte: string }[] = post.paragraphes ?? []
  const faq: { question: string; reponse: string }[]    = post.faq         ?? []
  const mots: string[]                                  = post.mots_cles   ?? []

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.titre,
    description: post.meta_desc,
    datePublished: post.published_at,
    author: { '@type': 'Organization', name: 'Owise' },
    publisher: { '@type': 'Organization', name: 'Owise', url: 'https://www.owise.fr' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.owise.fr/blog/${slug}` },
  }

  const faqLd = faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.reponse },
    })),
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F1', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      {/* Header */}
      <div style={{ background: '#09091A', padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 860, margin: '0 auto' }}>
        <Link href="/blog" style={{ fontSize: 12, color: 'rgba(201,168,76,.8)', textDecoration: 'none', letterSpacing: '.08em' }}>← Blog</Link>
        <Link href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 600, letterSpacing: '.1em', color: '#EDE8DF', textDecoration: 'none' }}>OWISE</Link>
        <Link href="/reserver" style={{ fontSize: 12, color: 'rgba(201,168,76,.8)', textDecoration: 'none' }}>Réserver →</Link>
      </div>

      <article style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          {post.categorie && (
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: 'rgba(201,168,76,.12)', color: '#C9A84C' }}>
              {post.categorie}
            </span>
          )}
          {date && <span style={{ fontSize: 11, color: '#9B9B9B' }}>{date}</span>}
        </div>

        {/* Titre */}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 500, color: '#09091A', lineHeight: 1.2, margin: '0 0 24px' }}>
          {post.titre}
        </h1>

        {/* Intro */}
        <p style={{ fontSize: 16, color: '#3a3a4a', lineHeight: 1.8, marginBottom: 36, padding: '20px 22px', background: '#fff', borderRadius: 10, borderLeft: '3px solid #C9A84C' }}>
          {post.intro}
        </p>

        {/* Paragraphes */}
        {paragraphes.map((para, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: '#09091A', marginBottom: 12 }}>
              {para.titre}
            </h2>
            <p style={{ fontSize: 15, color: '#3a3a4a', lineHeight: 1.8 }}>{para.texte}</p>
          </div>
        ))}

        {/* Conclusion */}
        <div style={{ background: '#09091A', borderRadius: 12, padding: '24px 22px', margin: '40px 0' }}>
          <p style={{ color: '#EDE8DF', lineHeight: 1.8, margin: 0, fontSize: 15 }}>{post.conclusion}</p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', margin: '40px 0' }}>
          <Link href="/reserver" style={{
            display: 'inline-block', background: '#C9A84C', color: '#09091A',
            textDecoration: 'none', padding: '14px 36px', borderRadius: 8,
            fontWeight: 700, fontSize: 14,
          }}>
            Réserver mon VTC →
          </Link>
        </div>

        {/* FAQ */}
        {faq.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: '#09091A', marginBottom: 24 }}>
              Questions fréquentes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faq.map((f, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', border: '1px solid rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#09091A', marginBottom: 6 }}>{f.question}</div>
                  <div style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7 }}>{f.reponse}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mots-clés */}
        {mots.length > 0 && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {mots.map(m => (
              <span key={m} style={{ fontSize: 10, color: '#9B9B9B', background: '#f0ede8', borderRadius: 20, padding: '4px 12px' }}>{m}</span>
            ))}
          </div>
        )}

        {/* Pages associées */}
        {(DESTINATIONS[slug] ?? []).length > 0 && (
          <div style={{ marginTop: 40, padding: '20px 22px', background: '#fff', borderRadius: 10, border: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9B9B9B', marginBottom: 12 }}>
              Pages associées
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(DESTINATIONS[slug] ?? []).map(d => (
                <Link key={d.href} href={d.href} style={{
                  fontSize: 12, fontWeight: 500, color: '#09091A',
                  background: '#F8F6F1', border: '1px solid rgba(201,168,76,.2)',
                  borderRadius: 6, padding: '6px 14px', textDecoration: 'none',
                }}>
                  {d.label} →
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Retour blog */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/blog" style={{ fontSize: 13, color: '#C9A84C', textDecoration: 'none' }}>← Tous les articles</Link>
          <Link href="/reserver" style={{ fontSize: 13, color: '#09091A', textDecoration: 'none', fontWeight: 600 }}>Réserver maintenant →</Link>
        </div>
      </article>
    </div>
  )
}
