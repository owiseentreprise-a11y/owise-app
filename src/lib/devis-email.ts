/**
 * Le message qui accompagne un devis — écrit ici, et nulle part ailleurs.
 *
 * Pourquoi ce fichier existe
 * ──────────────────────────
 * Le 2026-11-02, une réponse à une demande d'estimation est partie chez une
 * cliente professionnelle avec, en toutes lettres :
 *
 *     « Concernant les conditions d'annulation, [à compléter selon vos
 *       conditions]. »
 *
 * Le message avait été assemblé à la main dans Gmail à partir d'un modèle, et
 * le trou n'avait pas été rebouché. Il portait aussi « Owise.fre », aucune
 * mention de TVA, et une copie d'écran du simulateur montrant une date vide.
 *
 * Deux formes, deux usages
 * ────────────────────────
 * `composerEmailDevis`   — l'e-mail qu'OWISE expédie lui-même, bandeau
 *                          compris. Pour un client venu de WhatsApp ou du
 *                          téléphone : aucune conversation à respecter.
 *
 * `composerReponseDevis` — le même contenu, SOBRE, à coller dans une réponse
 *                          Gmail. Quand la cliente a écrit la première, sa
 *                          demande et la réponse doivent rester dans le même
 *                          fil : un message séparé tomberait à côté. Un
 *                          bandeau noir et or dans un fil de discussion fait
 *                          publicité, pas réponse — d'où la version nue, avec
 *                          une vraie signature. C'est le PDF joint qui porte
 *                          le côté officiel.
 *
 * Trois décisions communes :
 *
 *  1. Le modèle ne contient AUCUN trou à remplir. Ce qui varie d'un devis à
 *     l'autre vient de la base ; ce qui est propre à un client se saisit dans
 *     le champ « notes » du devis, et n'apparaît que s'il est rempli.
 *  2. Les deux formes sont PURES et sans dépendance à Resend : l'écran
 *     d'aperçu affiche leur résultat, et l'envoi expédie ce même résultat. Si
 *     l'aperçu recomposait de son côté, on validerait un message et on en
 *     enverrait un autre.
 *  3. `trouRestant` relit le message fini et refuse de laisser partir un
 *     crochet oublié. Un contrôle vaut mieux qu'une relecture attentive.
 *
 * Ce que la signature affiche : Owise, le téléphone, l'e-mail, le SIRET.
 * Pas le nom de l'exploitant, pas son adresse — c'est la règle de CLAUDE.md,
 * et elle vaut ici comme sur le site. Ces deux mentions figurent sur le devis
 * joint, qui est un document contractuel.
 */
import { formaterMontant } from '@/lib/montant'
import { base, echapper, row } from '@/lib/email-gabarit'
import {
  dateCourte, dateLongue, detailLigne, phraseAttente,
  type DevisClient, type Prestataire,
} from '@/lib/devis-client'

export type EmailDevis = {
  destinataire: string | null
  sujet: string
  html: string
  /** La même chose en texte brut, à coller dans Gmail. */
  texte: string
}

/** La réponse à coller dans un fil Gmail : deux écritures du même message. */
export type ReponseDevis = {
  /** Texte riche, sans bandeau — garde ses alignements une fois collé. */
  html: string
  /** Repli, pour un champ qui n'accepte pas la mise en forme. */
  texte: string
}

/**
 * Un reste de modèle non rebouché : « [à compléter] », « XXX », « à définir ».
 *
 * On cherche sur le texte brut, pas sur le HTML — sinon chaque balise serait
 * signalée. Le seuil de trois caractères évite de confondre avec « [1] ».
 */
export function trouRestant(texte: string): string | null {
  const motifs: RegExp[] = [
    /\[[^\]\n]{3,}\]/,
    /\ba\s+complet(?:er|e)\b/i,
    /\bà\s+complét(?:er|e)\b/i,
    /\bà\s+définir\b/i,
    /\bXXX+\b/,
    /\bTODO\b/i,
    /\bLorem ipsum\b/i,
  ]
  for (const m of motifs) {
    const trouve = texte.match(m)
    if (trouve) return trouve[0]
  }
  return null
}

/** « jeudi 5 novembre 2026 », ou la date courte, ou rien. */
function jourPrestation(d: DevisClient): string | null {
  return dateLongue(d.date_prestation) ?? dateCourte(d.date_prestation)
}

const MENTION_TVA =
  'TVA non applicable, article 293 B du Code général des impôts — '
  + 'le montant indiqué est net de taxe.'

const PHRASE_ACCORD =
  'Pour accord, vous pouvez simplement répondre à ce message, ou nous '
  + 'retourner le devis signé avec la mention « bon pour accord ».'

/**
 * Tout ce que les deux formes ont à dire, assemblé une seule fois.
 *
 * Sans cela, le résumé et le détail seraient écrits deux fois, et la version
 * sobre finirait par annoncer autre chose que la version complète.
 */
function elements(d: DevisClient, p: Prestataire) {
  const jour = jourPrestation(d)
  const n = d.lignes.length
  const transferts = `${n} transfert${n > 1 ? 's' : ''}`
  const validite = dateCourte(d.date_validite)

  return {
    jour,
    attente: phraseAttente(d),
    notes: d.notes,
    sujet: jour
      ? `Devis ${d.numero} — ${transferts} le ${jour}`
      : `Devis ${d.numero} — Owise`,
    intro: `Faisant suite à votre demande, vous trouverez ci-joint notre devis n° ${d.numero}.`,
    resume: [
      ['Référence', d.numero],
      ['Prestations', transferts],
      ...(jour ? [['Date', jour]] : []),
      ['Montant', formaterMontant(Number(d.total_ht))],
      ...(validite ? [['Valable jusqu\'au', validite]] : []),
    ] as [string, string][],
    prestations: d.lignes.map(l => ({
      heure: l.heure || '',
      trajet: `${l.depart} → ${l.arrivee}`,
      detail: detailLigne(l),
      prix: formaterMontant(Number(l.prix)),
    })),
    signature: [
      'Owise',
      p.metier,
      [p.telephone, p.email].filter(Boolean).join(' · '),
      [p.siret ? `SIRET ${p.siret}` : null, 'owise.fr'].filter(Boolean).join(' · '),
    ].filter(Boolean) as string[],
  }
}

/**
 * Le corps en texte brut, partagé par les deux formes.
 *
 * `signature: false` pour la réponse collée dans Gmail : la messagerie y
 * ajoute déjà la signature réglée dans ses paramètres. En porter une
 * seconde en donnerait deux, l'une sous l'autre.
 */
function enTexte(e: ReturnType<typeof elements>, signature = true): string {
  const large = Math.max(...e.resume.map(([l]) => l.length))
  return [
    'Bonjour,',
    '',
    e.intro,
    '',
    ...e.resume.map(([l, v]) => `  ${l.padEnd(large)}   ${v}`),
    ...(e.prestations.length ? ['', 'Détail :',
      ...e.prestations.flatMap(t => [
        `  ${t.heure.padEnd(7)} ${t.trajet}`,
        ...(t.detail ? [`          ${t.detail}`] : []),
        `          ${t.prix}`,
      ]),
    ] : []),
    ...(e.notes ? ['', e.notes] : []),
    '',
    PHRASE_ACCORD,
    '',
    'Bien à vous,',
    ...(signature ? ['', ...e.signature] : []),
    /* Les mentions en dernier, apres la signature : elles doivent figurer,
       elles ne doivent pas occuper la place. Meme regle que sur le devis. */
    '',
    MENTION_TVA,
    ...(e.attente ? [`Temps d'attente — ${e.attente}`] : []),
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
//  1. L'e-mail qu'Owise expédie lui-même
// ─────────────────────────────────────────────────────────────────────────

export function composerEmailDevis(d: DevisClient, p: Prestataire): EmailDevis {
  const e = elements(d, p)

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre devis Owise</h2>
    <p style="margin:0 0 22px;font-size:14px;color:#848499;">
      Bonjour,<br>${echapper(e.intro)}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${e.resume.map(([l, v]) => row(echapper(l), echapper(v))).join('')}
    </table>

    ${e.prestations.length ? `
    <div style="font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px;">Détail</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid #E8E4DC;">
      ${e.prestations.map(t => `<tr>
        <td style="padding:9px 8px 9px 0;font-size:12px;color:#848499;white-space:nowrap;vertical-align:top;border-bottom:1px solid #F0EDE7;">${echapper(t.heure)}</td>
        <td style="padding:9px 0;font-size:13px;color:#1a1a2e;vertical-align:top;border-bottom:1px solid #F0EDE7;">
          ${echapper(t.trajet)}${t.detail ? `<br><span style="font-size:11.5px;color:#848499;">${echapper(t.detail)}</span>` : ''}
        </td>
        <td style="padding:9px 0 9px 8px;font-size:13px;color:#1a1a2e;font-weight:500;text-align:right;white-space:nowrap;vertical-align:top;border-bottom:1px solid #F0EDE7;">${echapper(t.prix)}</td>
      </tr>`).join('')}
    </table>` : ''}

    <p style="margin:0 0 20px;font-size:12.5px;color:#848499;">${echapper(MENTION_TVA)}</p>

    ${e.attente ? `<div style="background:#FAF8F3;border:1px solid #EDE7D8;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
      <div style="font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Temps d'attente</div>
      <p style="margin:0;font-size:12.5px;color:#4a4a5e;line-height:1.7;">${echapper(e.attente)}</p>
    </div>` : ''}

    ${e.notes ? `<p style="margin:0 0 20px;font-size:13.5px;color:#1a1a2e;line-height:1.7;white-space:pre-line;">${echapper(e.notes)}</p>` : ''}

    <p style="margin:0 0 20px;font-size:13.5px;color:#1a1a2e;line-height:1.7;">${echapper(PHRASE_ACCORD)}</p>

    <p style="margin:0 0 24px;font-size:13.5px;color:#1a1a2e;">Nous restons à votre disposition.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E8E4DC;padding-top:16px;">
      <tr><td style="padding-top:16px;font-size:12.5px;color:#848499;line-height:1.8;">
        <strong style="color:#09091A;font-size:13.5px;">${echapper(e.signature[0])}</strong><br>
        ${e.signature.slice(1).map(l => echapper(l)).join('<br>')}
      </td></tr>
    </table>
  `)

  return { destinataire: d.client_email, sujet: e.sujet, html, texte: enTexte(e) }
}

// ─────────────────────────────────────────────────────────────────────────
//  2. La réponse sobre, à coller dans un fil Gmail
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pas de bandeau, pas d'aplat de couleur, pas de largeur imposée : le bloc
 * doit se fondre dans une réponse.
 *
 * Contraintes de Gmail, apprises à ses dépens par tout le monde : il ne garde
 * que les styles EN LIGNE, ignore `flex` et `grid`, et supprime les feuilles
 * de style. D'où des `<table>` et des styles sur chaque cellule — seule
 * construction qui garde ses alignements après un copier-coller.
 */
export function composerReponseDevis(d: DevisClient, p: Prestataire): ReponseDevis {
  const e = elements(d, p)
  const police = "font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#202124;line-height:1.6"
  const discret = 'color:#5f6368'

  const html = `<div style="${police}">
<p style="margin:0 0 14px;">Bonjour,</p>
<p style="margin:0 0 18px;">${echapper(e.intro)}</p>

<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse;">
${e.resume.map(([l, v]) => `  <tr>
    <td style="padding:3px 22px 3px 0;${police};${discret};vertical-align:top;white-space:nowrap;">${echapper(l)}</td>
    <td style="padding:3px 0;${police};font-weight:bold;vertical-align:top;">${echapper(v)}</td>
  </tr>`).join('\n')}
</table>

${e.prestations.length ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse;">
  <tr>
    <td colspan="3" style="padding:0 0 6px;${police};${discret};border-bottom:1px solid #dadce0;">Détail</td>
  </tr>
${e.prestations.map(t => `  <tr>
    <td style="padding:9px 16px 9px 0;${police};${discret};vertical-align:top;white-space:nowrap;border-bottom:1px solid #f1f3f4;">${echapper(t.heure)}</td>
    <td style="padding:9px 24px 9px 0;${police};vertical-align:top;border-bottom:1px solid #f1f3f4;">${echapper(t.trajet)}${
      t.detail ? `<br><span style="${police};font-size:13px;${discret};">${echapper(t.detail)}</span>` : ''}</td>
    <td style="padding:9px 0;${police};font-weight:bold;text-align:right;vertical-align:top;white-space:nowrap;border-bottom:1px solid #f1f3f4;">${echapper(t.prix)}</td>
  </tr>`).join('\n')}
</table>` : ''}

${e.notes ? `<p style="margin:0 0 18px;${police};white-space:pre-line;">${echapper(e.notes)}</p>` : ''}

<p style="margin:0 0 18px;">${echapper(PHRASE_ACCORD)}</p>
<p style="margin:0 0 16px;">Bien à vous,</p>

<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr><td style="padding:10px 0 0;border-top:1px solid #e8eaed;">
    <div style="${police};font-size:11px;color:#80868b;line-height:1.6;">${echapper(MENTION_TVA)}</div>
${e.attente ? `    <div style="${police};font-size:11px;color:#80868b;line-height:1.6;margin-top:3px;">Temps d'attente — ${echapper(e.attente)}</div>` : ''}
  </td></tr>
</table>
</div>`

  /* Pas de signature ici : Gmail ajoute la sienne sous la réponse. En
     poser une seconde en donnerait deux l'une sur l'autre — relevé avant
     livraison, le 2026-11-02. Elle se règle une fois pour toutes dans
     Gmail, avec `npx tsx scripts/signature-gmail.mts`. */
  return { html, texte: enTexte(e, false) }
}
