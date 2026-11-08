'use client'

import { useEffect } from 'react'
import { enregistrerOrigine } from '@/lib/origine-visite'

/**
 * Relève l'origine de la visite à l'ouverture de l'onglet.
 *
 * Posé dans le gabarit racine, donc présent sur toutes les pages publiques.
 * `enregistrerOrigine()` ne fait rien si l'origine est déjà relevée : c'est
 * ce qui empêche la deuxième page de la visite d'écraser le vrai référent
 * par « owise.fr ».
 *
 * N'affiche rien et ne retarde rien : l'effet tourne après l'affichage.
 */
export default function OrigineVisite() {
  useEffect(() => { enregistrerOrigine() }, [])
  return null
}
