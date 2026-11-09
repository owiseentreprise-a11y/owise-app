'use client'

/**
 * Les onglets de la rubrique « Mesurer ».
 *
 * POURQUOI
 *
 * Le menu portait QUATRE entrées qui mesurent la même activité, les unes sous
 * les autres : Statistiques, Analytics, Estimations, Tunnel. Rien ne disait
 * laquelle ouvrir, et leurs noms ne le disaient pas non plus — « Analytics »
 * et « Tunnel » ne veulent rien dire pour qui n'a pas écrit le code.
 *
 * Une seule entrée au menu, quatre onglets ici, et chaque onglet dit en
 * français ce qu'il contient. Les adresses ne changent pas : les quatre pages
 * vivent désormais dans un groupe de routes `(mesures)`, qui ajoute cette
 * barre sans rien modifier dans les pages elles-mêmes.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = [
  { href: '/admin/stats',       label: 'Chiffres',    aide: 'Courses, chiffre d’affaires, véhicules' },
  { href: '/admin/analytics',   label: 'Visiteurs',   aide: 'D’où viennent les gens, ce qu’ils regardent' },
  { href: '/admin/estimations', label: 'Estimations', aide: 'Les prix que les visiteurs ont simulés' },
  { href: '/admin/funnel',      label: 'Tunnel',      aide: 'De la visite à la réservation' },
]

export default function OngletsMesures() {
  const chemin = usePathname()

  return (
    <div
      className="no-print"
      style={{
        display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        padding: '10px 32px 0',
        borderBottom: '1px solid rgba(201,168,76,.10)',
        background: 'var(--surface)',
      }}
    >
      {ONGLETS.map(o => {
        const actif = chemin === o.href || chemin.startsWith(o.href + '/')
        return (
          <Link
            key={o.href}
            href={o.href}
            title={o.aide}
            aria-current={actif ? 'page' : undefined}
            style={{
              position: 'relative',
              padding: '10px 14px 12px',
              fontSize: 12.5,
              fontWeight: actif ? 600 : 400,
              color: actif ? 'var(--gold)' : 'var(--t2)',
              textDecoration: 'none',
              borderBottom: `2px solid ${actif ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              /* La charte interdit `transition: all` : on n'anime que la couleur. */
              transition: 'color .15s',
            }}
          >
            {o.label}
          </Link>
        )
      })}
    </div>
  )
}
