/**
 * tarification-v2/lieu-court.ts — OÙ EST-CE ? Une adresse lue d'un coup d'œil.
 *
 * Demandé par l'exploitant le 2026-11-21 : dans /admin/tarification-v2, « je
 * ne vois pas les villes parfois, donc j'arrive pas à voir où c'est
 * exactement ». L'écran ne gardait que le premier morceau de l'adresse —
 * souvent la rue (« 14 Rue des Coteaux ») — et la ville disparaissait.
 *
 * Rend deux lignes :
 *   principal  la VILLE (« Chantilly », « Paris 3e ») — ou, pour un aéroport
 *              ou une gare, le LIEU (« Aéroport CDG - Terminal 2A »)
 *   detail     ce qui précise : la rue, ou la commune du lieu
 *
 * La commune vient des deux fonctions existantes d'estimation-anonyme.ts
 * (libellé Google « 60500 Chantilly », puis lieux connus de lieux.ts) : la
 * règle n'est pas écrite une seconde fois. Fonction pure, sans réseau.
 * Contrôle : scripts/tarification-v2/test-lieu-court.mts (adresses réelles).
 */
import { communeDepuisLibelle, communeDuLieuConnu } from '../estimation-anonyme'

export type LieuCourt = { principal: string; detail: string | null }

/** « 75003 Paris » → « Paris 3e » ; « 75001 Paris » → « Paris 1er » ; « 60500 Chantilly » → « Chantilly ». */
function nomDeCommune(cpEtCommune: string): string {
  const m = cpEtCommune.match(/^(\d{5})\s+(.+)$/)
  if (!m) return cpEtCommune
  const [, cp, nom] = m
  const propre = nom.replace(/[.\s]+$/, '').trim()
  if (/^75\d{3}$/.test(cp) && /^paris$/i.test(propre)) {
    const arr = Number(cp.slice(3))
    if (arr >= 1 && arr <= 20) return `Paris ${arr}${arr === 1 ? 'er' : 'e'}`
  }
  return propre
}

/** Un aéroport, une gare, un terminal : c'est le lieu qui parle, pas la commune. */
const EST_UN_LIEU = /a[ée]roport|\bgare\b|terminal|\borly\s*\d|\bcdg\b/i

export function lieuCourt(adresse: string | null | undefined): LieuCourt {
  const a = (adresse ?? '').trim()
  if (!a) return { principal: '—', detail: null }
  const morceaux = a.split(',').map(s => s.trim()).filter(s => s && !/^france$/i.test(s))
  const premier = (morceaux[0] ?? a).replace(/\.$/, '')

  // La commune : libellé Google, puis lieu connu, puis « Athis-Mons, 91200 ».
  let cpCommune = communeDepuisLibelle(a) ?? communeDuLieuConnu(a)
  if (!cpCommune) {
    const m = a.match(/([^,\d][^,]*),\s*(\d{5})\b/)
    if (m) cpCommune = `${m[2]} ${m[1].trim()}`
  }
  const commune = cpCommune ? nomDeCommune(cpCommune) : null

  if (EST_UN_LIEU.test(premier) || (!commune && morceaux.length === 1)) {
    return { principal: premier, detail: commune && !premier.toLowerCase().includes(commune.toLowerCase()) ? commune : null }
  }
  if (commune) {
    // Le détail ne répète pas la ville : on retire du premier morceau le code
    // postal et la commune. « 77990 Le Mesnil-Amelot » ne laisse rien ;
    // « 1 rue du jeu de paume 60200 Compiegne. » laisse la rue.
    const echappe = commune.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const reste = premier.replace(/\b\d{5}\b/g, '').replace(new RegExp(echappe, 'i'), '').replace(/[\s.,]+$/, '').replace(/^[\s.,]+/, '').trim()
    return { principal: commune, detail: reste || null }
  }
  return { principal: premier, detail: morceaux.slice(1).join(', ') || null }
}
