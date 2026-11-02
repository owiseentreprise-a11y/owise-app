/**
 * Fabrique la signature à coller dans Gmail — bloc visuel compris.
 *
 *   npx tsx scripts/signature-gmail.mts [fichier-de-sortie.html]
 *
 * Elle produit aussi `public/brand_assets/signature-owise.png`, le carré
 * sombre au sceau doré posé à gauche de la signature.
 *
 * Pourquoi une image, et pourquoi celle-là
 * ────────────────────────────────────────
 * Le logo du projet n'existe qu'en SVG, et **aucune messagerie n'affiche un
 * SVG** — ni Gmail, ni Outlook, ni Apple Mail. Il faut donc une image
 * matricielle, servie depuis une adresse publique.
 *
 * L'image ne porte **aucun texte** : les polices ne sont pas installées sur
 * la machine qui rastérise, et « OWISE » serait rendu dans une police de
 * secours — un logo approximatif est pire qu'une absence de logo. Le nom
 * reste donc du vrai texte HTML à côté : il se lit même quand l'image est
 * bloquée, il se sélectionne, et il se cherche.
 *
 * Ce que la signature affiche : Owise, le métier, la zone, le téléphone,
 * l'e-mail, le site, le SIRET. **Pas le nom de l'exploitant ni son
 * adresse** — règle de CLAUDE.md : ces deux mentions ne figurent que sur
 * les devis et les factures, où la loi les impose. Passer `--nom` les
 * ajoute, si l'exploitant le décide.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import sharp from 'sharp'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const { chargerPrestataire } = await import('../src/lib/devis-client')
const p = await chargerPrestataire()

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const avecNom = process.argv.includes('--nom')
const sortie = resolve(args[0] ?? 'signature-gmail.html')

// ── 1. Le carré, en PNG ─────────────────────────────────────────────────────

/* Le sceau du logo, redessiné à la taille d'affichage pour que les traits
   restent nets. Rendu à 2× : un écran Retina afficherait sinon du flou. */
const COTE = 112
const dessin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="${COTE * 2}" height="${COTE * 2}">
  <rect x="0" y="0" width="112" height="112" rx="16" fill="#09091A"/>
  <circle cx="56" cy="56" r="31" stroke="rgba(255,255,255,0.86)" stroke-width="2.6" fill="none"/>
  <path d="M56 25 A31 31 0 0 1 84 43" stroke="#C9A84C" stroke-width="3.4" stroke-linecap="round" fill="none"/>
  <circle cx="56" cy="56" r="6" fill="#C9A84C"/>
</svg>`

const cheminPng = resolve('public/brand_assets/signature-owise.png')
mkdirSync(dirname(cheminPng), { recursive: true })
await sharp(Buffer.from(dessin)).png({ compressionLevel: 9 }).toFile(cheminPng)

const URL_IMAGE = 'https://www.owise.fr/brand_assets/signature-owise.png'

// ── 2. La signature ─────────────────────────────────────────────────────────

const POLICE = 'font-family:Arial,Helvetica,sans-serif'
const ENCRE  = '#202124'
const GRIS   = '#5f6368'
const OR     = '#9A7A2A'

const tel = p.telephone ?? ''
const telBrut = tel.replace(/\s/g, '')

/** Une ligne de contact : libellé discret, valeur cliquable. */
const contact = (etiquette: string, valeur: string, lien?: string) => `
    <tr><td style="${POLICE};font-size:13px;color:${ENCRE};padding:1px 0;line-height:1.5;">
      <span style="color:${GRIS};">${etiquette}</span>${
        lien ? `<a href="${lien}" style="color:${ENCRE};text-decoration:none;">${valeur}</a>` : valeur
      }
    </td></tr>`

const signature = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${POLICE};">
  <tr>
    <td valign="top" style="padding:0 20px 0 0;">
      <img src="${URL_IMAGE}" width="${COTE}" height="${COTE}" alt="Owise"
           style="display:block;width:${COTE}px;height:${COTE}px;border:0;border-radius:16px;">
    </td>
    <td valign="top" style="padding:0;border-left:3px solid #C9A84C;padding-left:20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
${avecNom ? `        <tr><td style="${POLICE};font-size:17px;font-weight:bold;color:${ENCRE};padding:0 0 1px;line-height:1.3;">Houna Hassan</td></tr>
        <tr><td style="${POLICE};font-size:13px;font-weight:bold;color:${OR};padding:0 0 1px;line-height:1.45;">Owise — Chauffeur privé</td></tr>
        <tr><td style="${POLICE};font-size:13px;font-weight:bold;color:${OR};padding:0 0 9px;line-height:1.45;">Private chauffeur service</td></tr>`
          : `        <tr><td style="${POLICE};font-size:19px;font-weight:bold;color:${ENCRE};letter-spacing:1.5px;padding:0 0 2px;line-height:1.25;">OWISE</td></tr>
        <tr><td style="${POLICE};font-size:13px;font-weight:bold;color:${OR};padding:0 0 1px;line-height:1.45;">Chauffeur privé — mise à disposition</td></tr>
        <tr><td style="${POLICE};font-size:13px;font-weight:bold;color:${OR};padding:0 0 9px;line-height:1.45;">Private chauffeur service</td></tr>`}
        <tr><td style="padding:0 0 9px;"><div style="width:230px;height:1px;background:#dadce0;font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td style="${POLICE};font-size:13px;color:${GRIS};padding:1px 0 5px;line-height:1.5;">Paris · Île-de-France · Oise</td></tr>
${contact('Tél&nbsp;: ', tel, `tel:${telBrut}`)}
${contact('', p.email ?? '', `mailto:${p.email ?? ''}`)}
        <tr><td style="${POLICE};font-size:13px;font-weight:bold;padding:3px 0 0;line-height:1.5;">
          <a href="https://www.owise.fr" style="color:${OR};text-decoration:none;">www.owise.fr</a>
        </td></tr>
        <tr><td style="${POLICE};font-size:11.5px;color:#9aa0a6;padding:7px 0 0;line-height:1.5;">
          SIRET ${p.siret ?? ''} · TVA non applicable, art. 293 B du CGI
        </td></tr>
      </table>
    </td>
  </tr>
</table>`

// ── 3. La page qui sert à la copier ─────────────────────────────────────────

const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Signature Gmail — Owise</title></head>
<body style="margin:0;padding:40px 28px;background:#F4F2EE;${POLICE};color:${ENCRE};">
  <div style="max-width:720px;margin:0 auto;">
    <h1 style="font-size:20px;margin:0 0 14px;">Votre signature Gmail</h1>

    <ol style="font-size:14px;color:${ENCRE};margin:0 0 26px;padding-left:22px;line-height:1.85;">
      <li>Dans ce fichier, sélectionnez tout le bloc encadré ci-dessous —
          <b>du carré sombre à la ligne du SIRET</b> — et copiez&nbsp;(Ctrl+C).</li>
      <li>Dans Gmail&nbsp;: <b>Paramètres</b> (roue dentée) →
          <b>Voir tous les paramètres</b> → onglet <b>Général</b> → section
          <b>Signature</b> → <b>Créer</b>.</li>
      <li>Gmail demande « <b>Donnez un nom à la nouvelle signature</b> ». Il attend
          une simple étiquette&nbsp;: tapez <b>Owise</b>, rien d'autre, puis
          <b>Créer</b>. <span style="color:${GRIS};">Ne collez pas la signature ici&nbsp;:
          cette case est limitée à 320 caractères et ne sert qu'à nommer.</span></li>
      <li>Une <b>grande case avec une barre d'outils</b> (gras, italique, couleur…)
          apparaît à droite du nom. <b>Cliquez dedans</b>, puis collez&nbsp;(Ctrl+V).
          C'est là que va le bloc.</li>
      <li>Juste en dessous, deux menus déroulants&nbsp;: choisissez <b>Owise</b>
          pour les <b>nouveaux messages</b> <u>et</u> pour les
          <b>réponses/transferts</b>.</li>
      <li><b>Descendez tout en bas de la page</b> et cliquez sur
          <b>« Enregistrer les modifications »</b>.
          <span style="color:${GRIS};">Sans ce clic, Gmail ne garde rien — c'est
          l'étape qui fait croire que la signature n'est pas prise en compte.</span></li>
    </ol>

    <div style="background:#fff;border:1px solid #dadce0;border-radius:12px;padding:28px 30px;">
${signature}
    </div>

    <p style="font-size:13px;color:${GRIS};margin:24px 0 0;line-height:1.7;">
      Le carré est servi depuis <code style="font-size:12px;">${URL_IMAGE}</code>.
      Chez un destinataire qui bloque les images — c'est le réglage par défaut d'Outlook —
      le mot « Owise » s'affiche à sa place, et le reste de la signature reste entier.
    </p>
    <p style="font-size:12.5px;color:#9aa0a6;margin:14px 0 0;line-height:1.7;">
      Généré depuis les coordonnées enregistrées dans Owise. Si un numéro change,
      modifiez-le dans /admin/parametres puis relancez
      <code style="font-size:12px;">npx tsx scripts/signature-gmail.mts</code>.
    </p>
  </div>
</body></html>
`

writeFileSync(sortie, page, 'utf8')

console.log('\nImage     :', cheminPng, `(${COTE}×${COTE} affichés, rendus à 2×)`)
console.log('Signature :', sortie)
console.log('Nom de l’exploitant :', avecNom ? 'AFFICHÉ (--nom)' : 'masqué (règle de CLAUDE.md)')
console.log()
