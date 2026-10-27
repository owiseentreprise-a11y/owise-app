'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * « Paris en mouvement » — la carte animée de la vitrine.
 *
 * ── Ce qu'elle n'est pas ────────────────────────────────────────────────
 * Ce n'est pas une carte. Les positions et les tracés sont une composition
 * graphique : ils n'indiquent ni distances, ni itinéraires, ni position de
 * véhicule. La mention est écrite sous le dessin, en clair, et non reléguée
 * dans un attribut.
 *
 * Les sept lieux dessinés sont ceux que la vitrine annonce déjà dans « Nos
 * zones desservies » — Paris, Roissy-CDG, Orly, Beauvais-Tillé, Creil,
 * Chantilly, Senlis. Aucun autre n'est suggéré.
 *
 * AUCUN PRIX n'est écrit ici, contrairement au prototype. Un tarif affiché
 * sur cette carte serait une deuxième écriture des prix, à côté de la
 * source unique — exactement ce que le projet s'interdit depuis qu'il a
 * payé trois implémentations divergentes du calcul.
 *
 * ── Une courbe, écrite une seule fois ───────────────────────────────────
 * Chaque liaison vit dans `LIAISONS`, et sa courbe est posée UNE fois dans
 * `<defs>`. Le trait dessiné et la lumière qui le parcourt sont deux
 * `<use>` du même chemin : corriger une courbe les corrige tous les deux,
 * et il est impossible que la lumière s'écarte du trait.
 *
 * C'est aussi pour cela que la lumière n'emploie pas `offset-path` : cette
 * propriété réclame la courbe une deuxième fois, en toutes lettres, dans la
 * feuille de style — et elle n'existe pas avant Safari 16. Ici la lumière
 * est un tiret court qui glisse (`stroke-dashoffset`), compris par tous les
 * navigateurs, et qui suit le chemin référencé sans le réécrire.
 *
 * `pathLength="1"` normalise chaque courbe : le même réglage de tirets vaut
 * pour une liaison longue comme pour une courte, sans longueur à mesurer.
 *
 * ── Décorative, donc tue aux lecteurs d'écran ───────────────────────────
 * Elle n'apporte aucune information que la page ne donne ailleurs : les
 * mêmes villes sont listées en texte dans « Nos zones desservies ». Le bloc
 * porte donc `aria-hidden` — et il ne contient aucun élément focalisable,
 * sans quoi ce serait la faute relevée à l'étape 121 : un lecteur d'écran
 * qui se tait pendant que le clavier continue de s'y arrêter.
 *
 * ── Quand elle existe ───────────────────────────────────────────────────
 * Toujours, depuis le 2026-10-27. Elle est rendue DÈS LE SERVEUR, et c'est
 * voulu : le serveur et le navigateur rendent la même chose, donc aucun
 * décalage visible ni risque de désaccord d'hydratation. Rien ici ne dépend
 * du navigateur à l'affichage : le dessin est un SVG figé, et tout ce qui
 * bouge passe par un effet et par la feuille de style.
 */

/* Les sept lieux, en coordonnées du dessin.
     Beauvais-Tillé  96,84      Creil  238,146     Senlis  338,172
     Chantilly      262,206     CDG    404,318     Paris   242,400
     Orly           218,486
   Chaque courbe part du premier lieu et arrive au second : c'est le sens
   dans lequel la lumière la parcourt. `ton` règle l'épaisseur du trait,
   `duree` le temps d'un passage, `retard` le décalage de départ — ce sont
   ces décalages, tous différents, qui empêchent le trafic de battre la
   mesure. */
const LIAISONS = [
  { id: 'pmChantillyCdg', ton: 'fort', duree: 8.0, retard: 0.0,
    d: 'M 262 206 C 310 230, 364 266, 404 318' },
  { id: 'pmCdgParis', ton: 'moyen', duree: 7.4, retard: 1.1,
    d: 'M 404 318 C 386 364, 318 394, 242 400' },
  { id: 'pmParisBeauvais', ton: 'moyen', duree: 12.0, retard: 2.3,
    d: 'M 242 400 C 128 356, 74 226, 96 84' },
  { id: 'pmBeauvaisCdg', ton: 'moyen', duree: 11.0, retard: 0.6,
    d: 'M 96 84 C 180 136, 312 208, 404 318' },
  { id: 'pmCreilParis', ton: 'fin', duree: 8.5, retard: 3.4,
    d: 'M 238 146 C 230 226, 238 300, 242 400' },
  { id: 'pmChantillyParis', ton: 'fin', duree: 7.0, retard: 4.6,
    d: 'M 262 206 C 248 262, 244 330, 242 400' },
  { id: 'pmSenlisCdg', ton: 'fin', duree: 7.5, retard: 2.9,
    d: 'M 338 172 C 358 212, 382 262, 404 318' },
  { id: 'pmCreilCdg', ton: 'fin', duree: 9.5, retard: 5.2,
    d: 'M 238 146 C 320 150, 380 234, 404 318' },
  { id: 'pmSenlisParis', ton: 'fin', duree: 8.8, retard: 6.1,
    d: 'M 338 172 C 332 256, 288 340, 242 400' },
  { id: 'pmParisOrly', ton: 'moyen', duree: 6.4, retard: 3.9,
    d: 'M 242 400 C 234 436, 226 462, 218 486' },
  { id: 'pmChantillyOrly', ton: 'fin', duree: 10.5, retard: 7.2,
    d: 'M 262 206 C 194 292, 176 406, 218 486' },
  { id: 'pmCreilBeauvais', ton: 'fin', duree: 7.8, retard: 5.8,
    d: 'M 238 146 C 194 114, 146 90, 96 84' },
] as const

type Style = React.CSSProperties & Record<string, string | number>

export default function CarteParisEnMouvement() {
  const [vu, setVu] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  /* La chorégraphie ne part qu'une fois le bloc à l'écran : lancée au
     chargement, elle se jouerait sous le pli et personne ne la verrait.
     On n'emprunte pas l'observateur de `VitrineBody` — il recense les
     éléments une seule fois, dans un effet qui s'exécute AVANT que ce
     composant n'existe, et ne verrait donc jamais ce bloc.
     L'effet n'a pas de dépendance : le bloc existe dès le premier rendu,
     donc `ref.current` est déjà renseigné quand l'effet s'exécute. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver !== 'function') { setVu(true); return }
    const obs = new IntersectionObserver(entrees => {
      for (const e of entrees) if (e.isIntersecting) { setVu(true); obs.disconnect() }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    obs.observe(el)
    /* Si l'observateur est empêché, on montre tout plutôt que de laisser
       un bloc transparent : il ne doit jamais rester caché en attente. */
    const secours = setTimeout(() => setVu(true), 2500)
    return () => { obs.disconnect(); clearTimeout(secours) }
  }, [])

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`carte-pm${vu ? ' vue' : ''}`}
      aria-hidden="true"
    >
      <div className="carte-pm-inner">
        <div className="carte-pm-texte">
          <div className="carte-pm-tag">Paris · Île-de-France · Oise</div>
          <h2 className="carte-pm-titre">
            Nos liaisons, <em>d&apos;un trait</em>
          </h2>
          <p className="carte-pm-sous">
            De l&apos;Oise aux trois aéroports, de Paris à votre porte, et dans
            l&apos;autre sens aussi. Tarif fixe connu d&apos;avance, à toute heure.
          </p>
        </div>

        <div className="carte-pm-panneau">
          <svg className="carte-pm-plan" viewBox="0 0 480 540" focusable="false">
            <defs>
              <linearGradient id="pmFeu" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--or-clair)" />
                <stop offset="100%" stopColor="var(--or-profond)" />
              </linearGradient>
              <radialGradient id="pmLueur">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity=".55" />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
              </radialGradient>
              {/* La géométrie, écrite une seule fois pour toute la carte. */}
              {LIAISONS.map(l => (
                <path key={l.id} id={l.id} d={l.d} pathLength="1" fill="none" />
              ))}
            </defs>

            {/* Les cercles de distance, purement graphiques */}
            <g fill="none" style={{ stroke: 'var(--gold)' }} strokeOpacity=".12">
              <circle className="pm-arc" cx="242" cy="400" r="108" />
              <circle className="pm-arc pm-arc2" cx="242" cy="400" r="186" />
              <circle className="pm-arc pm-arc3" cx="242" cy="400" r="266" />
              <circle className="pm-arc pm-arc4" cx="242" cy="400" r="346" />
            </g>

            {/* La rose des vents */}
            <g fill="none" style={{ stroke: 'var(--sur-fonce)' }} strokeOpacity=".055">
              <path d="M242 400 L242 20" /><path d="M242 400 L470 150" />
              <path d="M242 400 L14 150" /><path d="M242 400 L470 470" />
              <path d="M242 400 L14 470" />
            </g>

            {/* Les liaisons : le trait se dessine, puis reste. */}
            <g fill="none" strokeLinecap="round">
              {LIAISONS.map((l, i) => (
                <use
                  key={l.id}
                  href={`#${l.id}`}
                  className={`pm-route pm-route-${l.ton}`}
                  style={{ '--rd': `${(0.55 + i * 0.14).toFixed(2)}s` } as Style}
                />
              ))}
            </g>

            {/* Le trafic : DEUX lumières par liaison, chacune à son rythme.
                La seconde part à mi-cycle de la première (voir `.pm-flux-bis`
                dans la feuille de style), si bien qu'une liaison n'est jamais
                vide bien longtemps. Mesuré : de 17 à 20 lumières en l'air une
                fois le régime établi, contre 5 à 8 avec une seule série. */}
            <g className="pm-trafic" fill="none" strokeLinecap="round">
              {LIAISONS.map(l => (
                <use
                  key={l.id}
                  href={`#${l.id}`}
                  className={`pm-flux pm-flux-${l.ton}`}
                  style={{ '--fd': `${l.duree}s`, '--ft': `${l.retard}s` } as Style}
                />
              ))}
              {LIAISONS.map(l => (
                <use
                  key={`${l.id}-bis`}
                  href={`#${l.id}`}
                  className={`pm-flux pm-flux-${l.ton} pm-flux-bis`}
                  style={{ '--fd': `${l.duree}s`, '--ft': `${l.retard}s` } as Style}
                />
              ))}
            </g>

            {/* Les lieux — ceux que « Nos zones desservies » annonce déjà */}
            <g>
              <g className="pm-pt pm-pt-beauvais">
                <circle cx="96" cy="84" r="5" style={{ fill: 'var(--sur-fonce)' }} fillOpacity=".9" />
                <text className="pm-nom" x="108" y="80">Beauvais-Tillé</text>
                <text className="pm-apt" x="108" y="97">Aéroport</text>
              </g>
              <g className="pm-pt pm-pt-creil">
                <circle cx="238" cy="146" r="5" style={{ fill: 'var(--sur-fonce)' }} fillOpacity=".9" />
                <text className="pm-nom" x="250" y="142">Creil</text>
              </g>
              <g className="pm-pt pm-pt-senlis">
                <circle cx="338" cy="172" r="5" style={{ fill: 'var(--sur-fonce)' }} fillOpacity=".9" />
                <text className="pm-nom" x="350" y="168">Senlis</text>
              </g>
              <g className="pm-pt pm-pt-chantilly">
                <circle className="pm-halo" cx="262" cy="206" r="16" fill="url(#pmLueur)" />
                <circle cx="262" cy="206" r="6.5" style={{ fill: 'var(--gold)' }} />
                <text className="pm-nom" x="244" y="203" textAnchor="end">Chantilly</text>
              </g>
              <g className="pm-pt pm-pt-cdg">
                <circle cx="404" cy="318" r="7" style={{ fill: 'var(--gold)' }} />
                <text className="pm-nom" x="330" y="346">Roissy CDG</text>
                <text className="pm-apt" x="330" y="363">Aéroport</text>
              </g>
              <g className="pm-pt pm-pt-paris">
                <circle cx="242" cy="400" r="8.5" style={{ fill: 'var(--sur-fonce)' }} />
                <text className="pm-nom pm-nom-paris" x="258" y="398">Paris</text>
              </g>
              <g className="pm-pt pm-pt-orly">
                <circle cx="218" cy="486" r="6" style={{ fill: 'var(--sur-fonce)' }} fillOpacity=".9" />
                <text className="pm-nom" x="230" y="483">Orly</text>
                <text className="pm-apt" x="230" y="500">Aéroport</text>
              </g>
            </g>
          </svg>

          <p className="carte-pm-note">
            Composition graphique. Les positions et les tracés sont stylisés :
            ils n&apos;indiquent ni distances, ni itinéraires, ni position
            d&apos;un véhicule.
          </p>
        </div>
      </div>
    </section>
  )
}
