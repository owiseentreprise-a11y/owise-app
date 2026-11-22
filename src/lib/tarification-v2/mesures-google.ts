/**
 * tarification-v2/mesures-google.ts — MESURER UN TRAJET, POUR LES DEUX CALCULS.
 *
 * Projet « Tarification v2 ». SERVEUR SEULEMENT (clé Google).
 *
 * Pour un départ et une arrivée écrits en toutes lettres, rend :
 *   · ce dont le calcul ACTUEL a besoin, obtenu exactement comme le site :
 *     le code postal (geocoderAdresse) et la distance routière
 *     (distanceRoutiereKm), tous deux de src/lib/geo.ts ;
 *   · ce dont le calcul V2 a besoin (règle du circuit réel, 2026-11-22) :
 *     approche base → départ, trajet, retour arrivée → base, en km ET en
 *     minutes (durée NORMALE : pas d'heure de départ, donc pas de bouchons)
 *     — la même mesure que celle des courses passées. Le retour au départ du
 *     client est encore mesuré, pour information seulement.
 */
import { geocoderAdresse, distanceRoutiereKm } from '@/lib/geo'
import type { BaseV2, Mesure, MesuresTrajet } from './grille'

const CLE = () => process.env.GOOGLE_MAPS_KEY ?? ''

/** Distance et durée normale entre deux adresses, ou null si Google ne sait pas. */
export async function mesurerV2(a: string, b: string): Promise<Mesure | null> {
  if (!CLE()) return null
  const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  u.searchParams.set('origins', a); u.searchParams.set('destinations', b)
  u.searchParams.set('mode', 'driving'); u.searchParams.set('language', 'fr'); u.searchParams.set('key', CLE())
  try {
    const e = (await (await fetch(u, { cache: 'no-store' })).json()).rows?.[0]?.elements?.[0]
    return e?.status === 'OK' ? { km: e.distance.value / 1000, min: e.duration.value / 60 } : null
  } catch { return null }
}

export type PointMesure = { saisie: string; libelleGoogle: string; cp: string }
export type TrajetMesure = {
  depart: PointMesure; arrivee: PointMesure
  /** Distance routière du site (geo.ts), pour le prix au km actuel. */
  distanceKm: number | null
  mesures: MesuresTrajet & { retour: Mesure }
}

export async function mesurerTrajet(depart: string, arrivee: string, bases: BaseV2[]): Promise<TrajetMesure | { erreur: string }> {
  const [gd, ga] = await Promise.all([geocoderAdresse(depart), geocoderAdresse(arrivee)])
  if ('error' in gd) return { erreur: `Départ introuvable (« ${depart} »)` }
  if ('error' in ga) return { erreur: `Arrivée introuvable (« ${arrivee} »)` }
  const [distanceKm, trajet, retour, ...autres] = await Promise.all([
    distanceRoutiereKm(gd, ga),
    mesurerV2(depart, arrivee),
    mesurerV2(arrivee, depart),
    ...bases.map(b => mesurerV2(b.adresse, depart)),
    ...bases.map(b => mesurerV2(arrivee, b.adresse)),
  ])
  const appr = autres.slice(0, bases.length), retB = autres.slice(bases.length)
  if (!trajet || !retour) return { erreur: 'Google ne donne pas de trajet routier entre ces deux adresses' }
  return {
    /* Le libellé passé à la détection de zone est la SAISIE, comme sur la
       vitrine (resoudreAdresse garde le libellé tapé ou choisi). */
    depart: { saisie: depart, libelleGoogle: gd.label, cp: gd.codePostal },
    arrivee: { saisie: arrivee, libelleGoogle: ga.label, cp: ga.codePostal },
    distanceKm,
    mesures: {
      trajet, retour,
      approches: Object.fromEntries(bases.map((b, i) => [b.nom, appr[i]])),
      retoursBase: Object.fromEntries(bases.map((b, i) => [b.nom, retB[i]])),
    },
  }
}
