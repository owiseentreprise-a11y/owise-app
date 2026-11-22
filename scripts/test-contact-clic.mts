/**
 * test-contact-clic.mts — le comptage des clics « Appeler » / WhatsApp / e-mail.
 *   npx tsx scripts/test-contact-clic.mts
 *
 * Trois devoirs :
 *   1. reconnaître TOUS les liens du site vers les coordonnées d'Owise — lus
 *      dans le code des pages publiques, pas dans une liste écrite ici ;
 *   2. ne PAS compter un autre numéro (chauffeur, client, sous-traitant) ;
 *   3. ne rien laisser partir d'identifiant (rue, numéro, nom).
 * Lecture seule : aucun appel réseau, aucune écriture.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { typeDeLien, estPageInterne, appareilDepuisUA, libelleBouton } from '../src/lib/contact-clic'
import { IDENTITE_OWISE } from '../src/lib/identite-owise'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }
const tel = IDENTITE_OWISE.telephone, mail = IDENTITE_OWISE.email

console.log(`${B}Les liens d'Owise sont reconnus${Z}`)
verifier(typeDeLien(`tel:${tel}`) === 'telephone', 'tel: au format international')
verifier(typeDeLien('tel:06 19 10 63 56') === 'telephone' && typeDeLien('tel:0619106356') === 'telephone', 'tel: au format français, avec ou sans espaces')
verifier(typeDeLien('https://wa.me/33619106356') === 'whatsapp' && typeDeLien('https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20un%20devis') === 'whatsapp', 'wa.me, avec ou sans message prérempli')
verifier(typeDeLien('https://api.whatsapp.com/send?phone=33619106356&text=x') === 'whatsapp', 'api.whatsapp.com?phone=')
verifier(typeDeLien(`mailto:${mail}`) === 'email' && typeDeLien(`mailto:${mail.toUpperCase()}?subject=Devis`) === 'email', 'mailto:, majuscules et sujet compris')

console.log(`\n${B}Les autres liens ne sont pas comptés${Z}`)
verifier(typeDeLien('tel:+33612345678') === null, 'le numéro d’un chauffeur ou d’un client')
verifier(typeDeLien('https://wa.me/33612345678?text=33619106356') === null, 'un autre WhatsApp, même si le numéro d’Owise est dans le message')
verifier(typeDeLien('mailto:quelquun@example.com') === null && typeDeLien('https://www.owise.fr/reserver') === null && typeDeLien('') === null && typeDeLien(null) === null, 'un autre e-mail, un lien ordinaire, un lien vide')
verifier(typeDeLien('mailto:%E0%A4%A') === null, 'un mailto mal encodé ne fait pas planter')

console.log(`\n${B}Pages et appareils${Z}`)
verifier(['/admin', '/admin/courses', '/chauffeur', '/sous-traitant', '/espace-client/x', '/login', '/client-login'].every(estPageInterne), 'administration, espaces privés et connexions : jamais comptés')
verifier(!['/', '/reserver', '/vtc-chantilly', '/en/book', '/sous-traitant-login-x', '/administration-vtc'].some(estPageInterne), 'les pages publiques sont comptées (et « /administration-vtc » n’est pas « /admin »)')
verifier(appareilDepuisUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148') === 'mobile'
  && appareilDepuisUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari') === 'mobile'
  && appareilDepuisUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)') === 'tablette'
  && appareilDepuisUA('Mozilla/5.0 (Linux; Android 13; SM-X200) Safari') === 'tablette'
  && appareilDepuisUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131') === 'ordinateur', 'iPhone, Android, iPad, tablette Android, ordinateur')

const faux = (attrs: Record<string, string>, texte: string, section: { id?: string; tag?: string; data?: string } | null) => ({
  getAttribute: (n: string) => attrs[n] ?? null, textContent: texte,
  closest: () => section && { id: section.id ?? '', tagName: (section.tag ?? 'SECTION').toUpperCase(), getAttribute: (n: string) => (n === 'data-section' ? section.data ?? null : null) },
})
verifier(libelleBouton(faux({ 'aria-label': 'WhatsApp' }, '', { tag: 'footer' })) === 'WhatsApp · footer', 'libellé : le nom accessible, puis la zone de la page')
verifier(libelleBouton(faux({}, '  Appeler   maintenant ', { id: 'hero' })) === 'Appeler maintenant · hero' && libelleBouton(faux({}, '', null)) === '(icône)', 'libellé : le texte du bouton, ou « (icône) »')

console.log(`\n${B}Tous les liens du site vers Owise sont comptés${Z}`)
{
  const fichiers: string[] = []
  const parcourir = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) parcourir(p); else if (/\.tsx$/.test(f)) fichiers.push(p) } }
  parcourir('src/app'); parcourir('src/components')
  const publics = fichiers.filter(f => !/[\\/](admin|chauffeur|sous-traitant|espace-client|api)[\\/]/.test(f) && !/SousTraitantPortal|ChauffeurApp/.test(f))
  const liens: { f: string; href: string }[] = []
  for (const f of publics) {
    const s = readFileSync(f, 'utf8')
    // Une variable locale qui vaut le numéro d'Owise (« const tel = IDENTITE_OWISE.telephone »)
    const locales = [...s.matchAll(/const (\w+) = IDENTITE_OWISE\.telephone/g)].map(x => x[1])
    for (const m of s.matchAll(/href=(?:"([^"]+)"|\{`([^`]+)`\}|'([^']+)')/g)) {
      const brut = (m[1] ?? m[2] ?? m[3])
        .replace(/\$\{IDENTITE_OWISE\.telephone\}/g, tel).replace(/\$\{IDENTITE_OWISE\.email\}/g, mail)
        .replace(/\$\{EMAIL_DEVIS\}/g, mail)
        .replace(/\$\{(\w+)\}/g, (t, v) => (locales.includes(v) ? tel : t))
      if (/^(tel:|mailto:|https:\/\/(wa\.me|api\.whatsapp))/.test(brut)) liens.push({ f, href: brut })
    }
  }
  const versOwise = liens.filter(l => l.href.replace(/\D/g, '').includes('619106356') || l.href.includes(mail) || l.href.includes('IDENTITE_OWISE'))
  const rates = versOwise.filter(l => typeDeLien(l.href) === null)
  verifier(versOwise.length >= 10, `${versOwise.length} liens vers Owise trouvés dans ${publics.length} fichiers publics`)
  verifier(rates.length === 0, `tous reconnus${rates.length ? ' — manqués : ' + rates.map(r => `${r.f}: ${r.href}`).join(' | ') : ''}`)
  const nonResolus = liens.filter(l => /\$\{/.test(l.href) && !versOwise.includes(l))
  console.log(`  (liens à variable non comptés, à revoir s'ils mènent à Owise : ${nonResolus.map(l => l.href).join(', ') || 'aucun'})`)
}

console.log(`\n${B}Rien d'identifiant ne part${Z}`)
{
  const route = readFileSync('src/app/api/contacts-clics/route.ts', 'utf8')
  const client = readFileSync('src/components/MesureContacts.tsx', 'utf8')
  verifier(/generaliserLieu\(dep\)/.test(route) && /generaliserLieu\(arr\)/.test(route), 'la route re-généralise les lieux du dernier prix (zone + commune)')
  verifier(!/\bip\b\s*[:,]/.test(route.slice(route.indexOf('.insert('))), 'l’adresse IP n’est pas enregistrée')
  verifier(!/localStorage|document\.cookie/.test(client + readFileSync('src/lib/contact-clic.ts', 'utf8')), 'ni cookie ni stockage durable : seulement le stockage de l’onglet')
  for (const f of ['src/components/VitrineBody.tsx', 'src/app/reserver/ReserverClient.tsx']) {
    const s = readFileSync(f, 'utf8'), i = s.indexOf('memoriserEstimation({')
    verifier(i > 0 && /lieuPourStatistique|lieuDep/.test(s.slice(i, i + 200)), `${f.split('/').pop()} : le dernier prix est mémorisé avec des lieux généralisés`)
  }
}

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
