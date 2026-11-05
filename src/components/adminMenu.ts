/**
 * L'état du tiroir de menu de l'administration, partagé.
 *
 * Deux composants doivent s'accorder dessus : la barre latérale, qui EST le
 * tiroir, et la navigation basse, dont le bouton « Plus » l'ouvre. Ils ne sont
 * pas parents l'un de l'autre.
 *
 * Un store minuscule plutôt qu'un contexte : pas de fournisseur à insérer dans
 * la mise en page, donc pas de composant client de plus autour de toute
 * l'administration. Et plutôt qu'un événement sur `window`, dont le nom
 * finirait écrit en toutes lettres à trois endroits.
 */
import { useSyncExternalStore } from 'react'

let ouvert = false
const abonnes = new Set<() => void>()

function prevenir() { for (const f of abonnes) f() }

export function ouvrirMenu()   { if (!ouvert) { ouvert = true;  prevenir() } }
export function fermerMenu()   { if (ouvert)  { ouvert = false; prevenir() } }
export function basculerMenu() { ouvert = !ouvert; prevenir() }

/**
 * Rend l'état du tiroir, et le re-rend à chaque changement.
 *
 * Le troisième argument de `useSyncExternalStore` est la valeur rendue au
 * serveur : `false`, pour que le rendu serveur et le premier rendu client
 * disent la même chose. Sans lui, React signale une incohérence d'hydratation.
 */
export function useMenuOuvert(): boolean {
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => { abonnes.delete(f) } },
    () => ouvert,
    () => false,
  )
}
