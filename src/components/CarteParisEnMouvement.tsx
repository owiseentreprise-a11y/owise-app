'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * « Paris en mouvement » — la carte animée du prototype 111, portée en
 * composant réel.
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
 * ── Décorative, donc tue aux lecteurs d'écran ───────────────────────────
 * Elle n'apporte aucune information que la page ne donne ailleurs : les
 * mêmes villes sont listées en texte dans « Nos zones desservies ». Le bloc
 * porte donc `aria-hidden` — et il ne contient aucun élément focalisable,
 * sans quoi ce serait la faute relevée à l'étape 121 : un lecteur d'écran
 * qui se tait pendant que le clavier continue de s'y arrêter.
 *
 * ── Quand elle existe ───────────────────────────────────────────────────
 * Toujours, depuis le 2026-10-27. Elle a vécu éteinte derrière un drapeau
 * `window.__OW_CARTE` que seul le proxy de prévisualisation posait : le
 * composant rendait `null` sur le site, et le dessin n'a jamais été vu
 * d'un visiteur. Le drapeau est retiré, le bloc est rendu comme les autres.
 *
 * Il est rendu DÈS LE SERVEUR, et c'est voulu : avec l'ancien montage, le
 * premier rendu donnait `null` et le bloc n'apparaissait qu'après le
 * montage côté navigateur — un décalage visible, et un risque de
 * désaccord d'hydratation. Ici le serveur et le navigateur rendent la même
 * chose. Rien dans ce composant ne dépend du navigateur à l'affichage :
 * le dessin est un SVG figé, et tout ce qui bouge passe par un effet.
 */

export default function CarteParisEnMouvement() {
  const [vu, setVu] = useState(false)
  const ref = useRef<HTMLElement | null>(null)

  /* La chorégraphie ne part qu'une fois le bloc à l'écran : lancée au
     chargement, elle se jouerait sous le pli et personne ne la verrait.
     On n'emprunte pas l'observateur de `VitrineBody` — il recense les
     éléments une seule fois, dans un effet qui s'exécute AVANT que ce
     composant n'existe, et ne verrait donc jamais ce bloc.
     L'effet n'a plus de dépendance : le bloc existe dès le premier rendu,
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
            De l&apos;Oise aux trois aéroports, et de Paris à votre porte.
            Tarif fixe connu d&apos;avance, à toute heure.
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

            {/* Les liaisons */}
            <g fill="none" strokeLinecap="round">
              <path className="pm-route" style={{ '--l': 250 } as React.CSSProperties}
                d="M 262 206 C 310 230, 364 266, 404 318" stroke="url(#pmFeu)" strokeWidth="3.4" />
              <path className="pm-route pm-r2" style={{ '--l': 320, stroke: 'var(--sur-fonce)' } as React.CSSProperties}
                d="M 96 84 C 180 136, 312 208, 402 312" strokeOpacity=".32" strokeWidth="1.8" />
              <path className="pm-route pm-r3" style={{ '--l': 262, stroke: 'var(--sur-fonce)' } as React.CSSProperties}
                d="M 238 146 C 230 226, 238 300, 242 400" strokeOpacity=".32" strokeWidth="1.8" />
              <path className="pm-route pm-r4" style={{ '--l': 120, stroke: 'var(--sur-fonce)' } as React.CSSProperties}
                d="M 242 400 C 234 436, 226 462, 218 486" strokeOpacity=".32" strokeWidth="1.8" />
              <path className="pm-route pm-r5" style={{ '--l': 200, stroke: 'var(--sur-fonce)' } as React.CSSProperties}
                d="M 338 172 C 358 212, 382 262, 402 312" strokeOpacity=".24" strokeWidth="1.5" />
              <path className="pm-route pm-r6" style={{ '--l': 210, stroke: 'var(--sur-fonce)' } as React.CSSProperties}
                d="M 262 206 C 248 262, 244 330, 242 400" strokeOpacity=".24" strokeWidth="1.5" />
            </g>

            {/* Le point lumineux, sur la liaison mise en avant */}
            <circle className="pm-luciole" r="5" style={{ fill: 'var(--or-clair)' }} />

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
