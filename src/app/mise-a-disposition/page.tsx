/**
 * Mise à disposition — un chauffeur réservé à l'heure, pas pour un trajet.
 *
 * POURQUOI CETTE PAGE EXISTE
 *
 * Mesure Search Console du 2026-11-12 : « private chauffeur in paris for a
 * full day, how much » montrait owise.fr 29 fois en huit semaines, en
 * position 9,4 — page 1 — pour **zéro clic**. Des gens demandaient le prix
 * d'une journée de chauffeur, Google proposait Owise, et le site n'avait
 * rien à répondre. Côté français, « mise à disposition chauffeur » tombait
 * en position 77 sur un article de blog : aucune page ne traitait le sujet.
 *
 * AUCUN PRIX N'EST ÉCRIT DANS CE FICHIER
 *
 * Même règle que les deux pages anglaises. Tous les montants viennent de la
 * table `tarifs`, colonne `prix_heure`, réglable depuis /admin/tarifs ; le
 * calcul vient de `prixMiseADisposition()` dans `calcPrix.ts`. Un montant
 * écrit ici serait un second barème, hors de portée de l'exploitant et de
 * tout contrôle.
 *
 * SI LA LECTURE ÉCHOUE, LA PAGE N'ANNONCE AUCUN PRIX plutôt qu'un prix faux :
 * chaque véhicule retombe alors sur « sur devis », ce qui reste vrai.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { GAMME } from '@/lib/gamme'
import { presentationVehicule } from '@/lib/presentation-vehicules'
import { BASE_OWISE, IDENTITE_OWISE, ficheAvis, lireAvis } from '@/lib/identite-owise'
import { EMAIL_DEVIS, telephoneLisible } from '@/lib/devis-et-tarifs'
import {
  DEFINITION, USAGES, SOUS_RESERVE, HEURE_ENTAMEE,
  MEME_ZONE, FRAIS_EN_SUS,
} from '@/lib/mise-a-disposition'
import { KM_PAR_HEURE_MAD, DUREE_MIN_MAD } from '@/lib/calcPrix'
import DemandeMiseADisposition, { type VehiculeMAD } from './DemandeMiseADisposition'
/* LA CHARTE DU SITE, PAS UNE PALETTE A MOI.
   `vitrine.css` porte les jetons de « Paris en mouvement » sous
   `.vt.vt-palette-a` — les memes que l'accueil, les 39 pages villes, /faq et
   /blog. Cette page avait d'abord ete dessinee avec ses propres couleurs
   (bleu nuit et or), heritees des pages anglaises : elle ressemblait a un
   autre site. Remarque de l'exploitant le 2026-11-13. On importe la feuille
   plutot que d'en recopier les valeurs. */
import '../vitrine.css'

export const revalidate = 3600

const CHEMIN = '/mise-a-disposition'
const URL_FR = `${BASE_OWISE}${CHEMIN}`
const URL_EN = `${BASE_OWISE}/en/private-chauffeur-paris`
const TITRE  = 'Mise à disposition d’un chauffeur — Paris et Île-de-France'

export const metadata: Metadata = {
  title: TITRE,
  description:
    'Un chauffeur et un véhicule réservés à l’heure, à la demi-journée ou à la '
    + 'journée, à Paris et en Île-de-France. Tarif horaire annoncé par véhicule, '
    + 'toute heure entamée est due, sous réserve de disponibilité.',
  alternates: { canonical: URL_FR, languages: { fr: URL_FR, en: URL_EN } },
  openGraph: { title: TITRE, url: URL_FR, type: 'website', locale: 'fr_FR' },
}

/** Les véhicules avec leur tarif horaire, tels qu'ils sont en base. */
async function lireVehicules(): Promise<{ vehicules: VehiculeMAD[]; avis: { nombre: number; note: number } }> {
  const admin = createAdminClient()
  const [{ data: tarifs }, avis] = await Promise.all([
    admin.from('tarifs').select('*'),   /* '*' et pas une liste : voir la note dans tarification.ts */
    lireAvis(admin),
  ])

  /* L'ordre vient de GAMME, seule source des noms et de l'ordre d'affichage.
     Lire l'ordre de la base donnerait un classement par identifiant. */
  const vehicules: VehiculeMAD[] = GAMME.map(v => {
    const ligne = (tarifs ?? []).find((t: { vehicule: string }) => t.vehicule === v.nomTarif)
    const brut = ligne?.prix_heure
    const prixHeure = brut == null ? null : Number(brut)
    return {
      cle: v.cle,
      nom: v.nom,
      places: v.capaciteMin === v.capaciteMax
        ? `${v.capaciteMax} passagers`
        : `${v.capaciteMin} à ${v.capaciteMax} passagers`,
      prixHeure: prixHeure != null && Number.isFinite(prixHeure) && prixHeure > 0 ? prixHeure : null,
      prixKmSup: (() => {
        const b = ligne?.prix_km_sup
        const n = b == null ? null : Number(b)
        return n != null && Number.isFinite(n) && n > 0 ? n : null
      })(),
      /* L'illustration vient de la MÊME source que la flotte de l'accueil.
         Une clé inconnue rend `null`, et la carte s'affiche sans bulle. */
      image: presentationVehicule(v.cle)?.img ?? null,
    }
  })
  return { vehicules, avis }
}

const FAQ = [
  {
    q: 'Qu’est-ce qu’une mise à disposition ?',
    a: DEFINITION,
  },
  {
    q: 'Comment les heures sont-elles comptées ?',
    a: `Elles courent de l’heure de prise en charge à l’heure où vous libérez le `
       + `chauffeur. ${HEURE_ENTAMEE} Une prestation de 3 h 15 est donc facturée 4 h.`,
  },
  {
    q: 'Le prix annoncé est-il garanti ?',
    a: `Le tarif horaire affiché est celui qui s’applique. ${SOUS_RESERVE} `
       + `Nous confirmons la disponibilité du véhicule avant toute réservation ferme.`,
  },
  {
    q: 'Combien de kilomètres sont compris ?',
    /* Les chiffres se calculent, ils ne se recopient pas : changer
       `KM_PAR_HEURE_MAD` doit changer cette réponse. En revanche on
       n'appelle PAS `phraseKilometres` ici — elle rend une phrase finie,
       ponctuation comprise, et l'enchâsser donnait « 80 km compris. pour
       4 h ». Une fonction qui écrit une phrase ne s'imbrique pas dans une
       autre phrase. */
    a: `${KM_PAR_HEURE_MAD} km par heure réservée, comptés sur le total : `
       + `${4 * KM_PAR_HEURE_MAD} km pour 4 h, ${8 * KM_PAR_HEURE_MAD} km pour 8 h. `
       + `Au-delà, le kilomètre est facturé au tarif indiqué sur la carte du véhicule. `
       + MEME_ZONE,
  },
  {
    q: 'Les péages et le stationnement sont-ils compris ?',
    a: FRAIS_EN_SUS,
  },
  {
    q: 'Puis-je changer de programme en cours de journée ?',
    a: 'Oui, c’est l’intérêt de la formule : le chauffeur reste avec vous et vous '
       + 'décidez des étapes au fur et à mesure, dans la limite de la durée réservée.',
  },
  {
    q: 'Et si la prestation dure plus longtemps que prévu ?',
    a: `Les heures supplémentaires se facturent au même tarif horaire, `
       + `${HEURE_ENTAMEE.toLowerCase()}`,
  },
]

export default async function Page() {
  const { vehicules, avis } = await lireVehicules()
  const tarifes = vehicules.filter(v => v.prixHeure != null)

  const ficheLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Mise à disposition de chauffeur avec véhicule',
    provider: { '@type': 'LocalBusiness', ...IDENTITE_OWISE },
    areaServed: [
      { '@type': 'City', name: 'Paris' },
      { '@type': 'AdministrativeArea', name: 'Île-de-France' },
      { '@type': 'AdministrativeArea', name: 'Oise' },
    ],
    url: URL_FR,
    description: DEFINITION,
    /* Les offres portent le prix HORAIRE, avec son unité. Déclarer « 60 »
       sans dire « par heure » laisserait croire à un forfait. */
    offers: tarifes.map(v => ({
      '@type': 'Offer',
      name: `Mise à disposition — ${v.nom}`,
      priceCurrency: 'EUR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(v.prixHeure),
        priceCurrency: 'EUR',
        unitCode: 'HUR',
        unitText: 'heure',
        valueAddedTaxIncluded: true,
      },
      availability: 'https://schema.org/LimitedAvailability',
    })),
    aggregateRating: ficheAvis(avis.nombre, avis.note),
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const filAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Owise', item: BASE_OWISE },
      { '@type': 'ListItem', position: 2, name: 'Mise à disposition', item: URL_FR },
    ],
  }

  const or = 'var(--gold)'
  const creme = 'var(--t1)'
  const doux = 'var(--t2)'
  const pale = 'var(--t2)'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filAriane) }} />

      {/* LES TROIS RÈGLES QUI DEMANDENT UNE LARGEUR D'ÉCRAN.
          Tout le reste de cette page est en style en ligne ; une requête
          média ne s'y écrit pas. Ces trois-là ont été ajoutées après
          MESURE sur un téléphone de 390 px, où l'en-tête prenait trois
          lignes et où le simulateur commençait à 580 px du haut — « il
          faut vraiment descendre pour le deviner », 2026-11-13.
          Préfixe `mad-` : ces classes n'existent que sur cette page. */}
      <style>{`
        /* Sous 560 px, l'en-tête garde le logo, le téléphone et la langue.
           « Réserver un transfert » disparaît : c'est un lien de rebond,
           pas une urgence, et il reste dans le pied de page. */
        @media (max-width: 560px) {
          .mad-lien-transfert { display: none; }
          .mad-entete { gap: 10px; padding-left: 16px; padding-right: 16px; }
        }
        /* Le panneau du simulateur chevauche le bandeau de 34 px sur grand
           écran ; sur téléphone ce chevauchement mange le dernier repère. */
        @media (max-width: 720px) {
          .mad-panneau { margin-top: 0 !important; }
        }
      `}</style>

      <main className="vt vt-palette-a" style={{ minHeight: '100vh', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>

        {/* ── En-tête ─────────────────────────────────────────────────
            Il ne portait que le logo et « English version ». Un visiteur
            arrivé ici par Google n'avait aucun moyen de joindre Owise ni
            de revenir vers le reste du site : la page était un cul-de-sac.
            On y met donc les trois choses qu'on cherche sur une page de
            service — téléphoner, voir l'autre offre, changer de langue. */}
        <header className="mad-entete" style={{
          background: 'var(--nuit)',
          borderBottom: '1px solid rgba(var(--contraste-rvb),.08)', padding: '13px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, flexWrap: 'wrap',
        }}>
          <Link href="/" style={{ color: or, textDecoration: 'none', fontSize: 17, fontWeight: 600, letterSpacing: '.14em' }}>
            OWISE
          </Link>
          {/* UN <div role="navigation">, ET SURTOUT PAS UN <nav>.
              `vitrine.css` style l'ELEMENT `nav` lui-meme :
              `nav{position:fixed;top:0;left:0;right:0;…}`, c'est la barre
              du site. Un `<nav>` ecrit ici devient donc une barre fixe
              pleine largeur posee par-dessus l'en-tete : mesure du
              2026-11-13, « OWISE » et « Reserver un transfert » se
              chevauchaient. Le role porte la meme semantique sans
              declencher le selecteur. Regle generale dans ce fichier :
              importer `vitrine.css`, c'est heriter de ses selecteurs
              d'element — se mefier aussi de `header`, `section`, `h2`. */}
          <div role="navigation" aria-label="Liens utiles"
            style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
            <Link href="/reserver" className="mad-lien-transfert" style={{ color: doux, textDecoration: 'none' }}>
              Réserver un transfert
            </Link>
            {/* Le numéro en toutes lettres, cliquable : sur un téléphone,
                c'est le chemin le plus court vers une réservation. */}
            <a href={`tel:${IDENTITE_OWISE.telephone}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36,
              padding: '0 13px', borderRadius: 8, textDecoration: 'none',
              color: creme, background: 'rgba(var(--contraste-rvb),.06)',
              border: '1px solid rgba(var(--contraste-rvb),.12)', fontWeight: 500,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              {telephoneLisible(IDENTITE_OWISE.telephone)}
            </a>
            <Link href="/en/private-chauffeur-paris" hrefLang="en" style={{ color: pale, textDecoration: 'none' }}>
              English →
            </Link>
          </div>
        </header>

        {/* ── Bandeau ─────────────────────────────────────────────────── */}
        <section style={{ background: 'var(--nuit)', padding: 'clamp(26px, 5vw, 48px) 20px clamp(38px, 6vw, 56px)' }}>
         <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <p style={{ fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 18 }}>
            Chauffeur à l’heure · Paris &amp; Île-de-France
          </p>
          <h1 style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: 'clamp(29px, 6.2vw, 58px)', fontWeight: 500, lineHeight: 1.08,
            color: creme, margin: '0 0 22px', textWrap: 'balance',
          }}>
            Un chauffeur à votre disposition, à l’heure ou à la journée
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: doux, maxWidth: 660, margin: '0 0 22px' }}>
            {DEFINITION}
          </p>

          {/* ── Les trois choses qu'on veut savoir avant de simuler ─────
              Le bandeau enchaînait DEUX paragraphes, dont les mentions
              légales sur les péages — du texte à lire avant d'atteindre le
              moindre prix. Ces mentions n'ont pas disparu : elles sont sous
              le simulateur, là où elles servent à décider. Ici ne restent
              que les trois repères qui donnent envie d'essayer, chacun
              calculé et non recopié. */}
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexWrap: 'wrap', gap: 10,
          }}>
            {[
              `À partir de ${DUREE_MIN_MAD} h`,
              `${KM_PAR_HEURE_MAD} km compris par heure`,
              'Prix annoncé tout de suite',
            ].map(t => (
              <li key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13.5, color: creme, lineHeight: 1.4,
                padding: '8px 14px', borderRadius: 999,
                background: 'rgba(var(--contraste-rvb),.05)',
                border: '1px solid rgba(var(--contraste-rvb),.10)',
              }}>
                <span aria-hidden="true" style={{
                  width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0,
                }} />
                {t}
              </li>
            ))}
          </ul>
         </div>
        </section>

        {/* ── Le simulateur, AUSSI HAUT QUE POSSIBLE ───────────────────
            Il venait en troisième, après une grille « Tarif horaire par
            véhicule » qui montrait déjà ces quatre véhicules et ces quatre
            prix. Deux fois la même information, et le simulateur repoussé
            sous la ligne de flottaison — l'exploitant, le 2026-11-13 :
            « pour faire la simulation, c'est tout en bas, il faut vraiment
            descendre pour le deviner ».

            La grille est supprimée, pas son contenu : le prix horaire, la
            capacité, le forfait kilométrique et l'illustration sont
            maintenant portés par la carte qu'on clique pour choisir. On lit
            et on agit au même endroit. */}
        <section id="demande" className="mad-panneau" style={{ padding: '0 20px 56px', maxWidth: 940, margin: '-34px auto 0' }}>
          <div style={{
            background: 'var(--papier)', border: '1px solid rgba(var(--contraste-rvb),.08)',
            borderRadius: 18, padding: 'clamp(20px, 4vw, 34px)',
            /* Une ombre portée, pour que le panneau se détache du bandeau
               qu'il chevauche. Teintée nuit, jamais un gris générique. */
            boxShadow: '0 22px 50px -24px rgba(0,0,0,.55)',
          }}>
            <h2 style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: 'clamp(21px, 3.4vw, 32px)', fontWeight: 500, color: creme, margin: '0 0 5px',
            }}>
              Calculez votre mise à disposition
            </h2>
            <p style={{ fontSize: 14, color: pale, margin: '0 0 clamp(16px, 2.6vw, 26px)' }}>
              Choisissez le véhicule et la durée : le prix s’affiche tout de suite.
            </p>
            <DemandeMiseADisposition vehicules={vehicules} />
          </div>
        </section>

        {/* ── Ce qui est compris, ce qui ne l'est pas ──────────────────
            Ces phrases existaient déjà, enfouies dans un paragraphe de
            mentions sous le bandeau et dans la FAQ. Un client qui hésite
            ne lit pas un paragraphe : il cherche la frontière entre ce
            qu'il paie et ce qui s'ajoutera. On la lui montre, en deux
            colonnes, avec les MÊMES phrases — aucune réécriture, sinon
            deux versions d'une règle finiraient par diverger. */}
        <section style={{ padding: '0 20px 48px', maxWidth: 940, margin: '0 auto' }}>
          <h2 style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: pale, marginBottom: 16, fontWeight: 500 }}>
            Ce que couvre le prix annoncé
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
            {[
              {
                titre: 'Compris',
                teinte: 'var(--vert-vif)',
                signe: 'M5 13l4 4L19 7',
                lignes: [
                  'Le chauffeur et le véhicule, pour toute la durée réservée.',
                  `${KM_PAR_HEURE_MAD} km par heure réservée, comptés sur le total.`,
                  'Les changements de programme en cours de route, dans la durée prévue.',
                ],
              },
              {
                titre: 'En plus du prix annoncé',
                teinte: 'var(--gold)',
                signe: 'M12 5v14M5 12h14',
                lignes: [
                  FRAIS_EN_SUS,
                  'Les kilomètres au-delà du forfait, au tarif de la carte du véhicule.',
                  `${HEURE_ENTAMEE} Une prestation de 3 h 15 est facturée 4 h.`,
                ],
              },
            ].map(bloc => (
              <div key={bloc.titre} style={{
                background: 'var(--papier)', border: '1px solid rgba(var(--contraste-rvb),.08)',
                borderRadius: 14, padding: '18px 20px 16px',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: creme, marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span aria-hidden="true" style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 19, height: 19, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(var(--contraste-rvb),.07)', color: bloc.teinte,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={bloc.signe} />
                    </svg>
                  </span>
                  {bloc.titre}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 9 }}>
                  {bloc.lignes.map(l => (
                    <li key={l} style={{ fontSize: 13.5, lineHeight: 1.6, color: doux, display: 'flex', gap: 9 }}>
                      <span aria-hidden="true" style={{
                        width: 4, height: 4, borderRadius: '50%', background: bloc.teinte,
                        flexShrink: 0, marginTop: 8,
                      }} />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.65, color: pale, margin: '14px 0 0', maxWidth: 680 }}>
            {SOUS_RESERVE} {MEME_ZONE}
          </p>
        </section>

        {/* ── Les occasions ───────────────────────────────────────────── */}
        <section style={{ padding: '0 20px 56px', maxWidth: 940, margin: '0 auto' }}>
          <h2 style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: pale, marginBottom: 16, fontWeight: 500 }}>
            Quand cette formule a du sens
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {USAGES.map(u => (
              <li key={u} style={{
                fontSize: 14.5, color: doux, lineHeight: 1.6,
                padding: '13px 16px', borderRadius: 11,
                background: 'var(--papier)', border: '1px solid rgba(var(--contraste-rvb),.08)',
              }}>
                {u}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Questions ───────────────────────────────────────────────── */}
        <section style={{ padding: '0 20px 60px', maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 500, color: creme, margin: '0 0 22px',
          }}>
            Questions fréquentes
          </h2>
          {FAQ.map(f => (
            <div key={f.q} style={{ borderTop: '1px solid rgba(var(--contraste-rvb),.08)', padding: '18px 0' }}>
              <h3 style={{ fontSize: 15.5, fontWeight: 600, color: creme, margin: '0 0 7px' }}>{f.q}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: doux, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </section>

        {/* ── Pied ────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: '1px solid rgba(var(--contraste-rvb),.08)', padding: '26px 20px 40px',
          maxWidth: 940, margin: '0 auto', fontSize: 13, color: pale, lineHeight: 1.8,
        }}>
          <div style={{ marginBottom: 8 }}>
            <Link href="/" style={{ color: or, textDecoration: 'none' }}>Owise</Link>
            {' · '}
            <Link href="/reserver" style={{ color: doux, textDecoration: 'none' }}>Réserver un transfert</Link>
            {' · '}
            <Link href="/mentions-legales" style={{ color: doux, textDecoration: 'none' }}>Mentions légales</Link>
          </div>
          <div>
            <a href={`tel:${IDENTITE_OWISE.telephone}`} style={{ color: doux, textDecoration: 'none' }}>
              {telephoneLisible(IDENTITE_OWISE.telephone)}
            </a>
            {' · '}
            <a href={`mailto:${EMAIL_DEVIS}`} style={{ color: doux, textDecoration: 'none' }}>{EMAIL_DEVIS}</a>
          </div>
        </footer>
      </main>
    </>
  )
}
