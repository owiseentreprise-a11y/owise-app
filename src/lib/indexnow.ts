/**
 * indexnow.ts — PRÉVENIR BING (ET DONC CHATGPT) QU'UNE PAGE A CHANGÉ.
 *
 * ChatGPT cherche dans l'index de Bing, pas dans celui de Google. Sans signal,
 * Bing découvre une page quand il repasse — des jours, parfois des semaines.
 * IndexNow est le protocole par lequel un site lui DIT qu'une adresse est
 * nouvelle ou modifiée. Il est partagé : Bing transmet à Yandex, Seznam, Naver.
 *
 * La clé n'est PAS un secret. Le protocole l'exige publique : Bing vérifie que
 * le site possède le domaine en lisant `https://www.owise.fr/<clé>.txt`, dont
 * le contenu doit être la clé elle-même — fichier `public/<clé>.txt`. Changer
 * la clé ici sans renommer ce fichier rend tous les signaux refusés (403).
 *
 * Contrôle : `node test-indexnow.mjs [url]` (dépôt des outils).
 */
export const INDEXNOW_CLE = '048128c612a7e89bff12a1e306f08f39'
const HOTE = 'www.owise.fr'
const ORIGINE = `https://${HOTE}`

/**
 * Signale des adresses à IndexNow. Ne lève JAMAIS : un signal manqué est
 * rattrapé au prochain passage du robot, une publication échouée ne l'est pas.
 * Accepte des chemins (« /blog/x ») ou des adresses complètes du site.
 */
export async function signalerAIndexNow(adresses: string[]): Promise<{ ok: boolean; statut: number; envoyees: number }> {
  const urlList = [...new Set(adresses.map(a => (a.startsWith('http') ? a : ORIGINE + a)))]
    .filter(u => u.startsWith(ORIGINE + '/') || u === ORIGINE)
  if (urlList.length === 0) return { ok: true, statut: 0, envoyees: 0 }
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOTE, key: INDEXNOW_CLE, keyLocation: `${ORIGINE}/${INDEXNOW_CLE}.txt`, urlList }),
      signal: AbortSignal.timeout(8000),
    })
    // 200 = reçu ; 202 = reçu, clé en cours de vérification. Tout le reste est un refus.
    return { ok: r.status === 200 || r.status === 202, statut: r.status, envoyees: urlList.length }
  } catch {
    return { ok: false, statut: -1, envoyees: urlList.length }
  }
}
