import { Resend } from 'resend'
import { TYPE_VEHICULE_LABEL } from './types'
import { genererFacturePdf } from './facture-pdf'
import { formaterMontant } from './facture-document'
import type { InfosCourseParams } from './courseMessage'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'OWISE <noreply@owise.fr>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL ?? 'https://g.page/r/CY0-ORyXWwpXEAE/review'

type PieceJointe = { filename: string; content: Buffer }

async function send(to: string, subject: string, html: string, attachments?: PieceJointe[]) {
  if (!resend) return
  try {
    await resend.emails.send({ from: FROM, to, subject, html, ...(attachments?.length ? { attachments } : {}) })
  } catch {
    // Ne pas faire planter l'action si l'email échoue
  }
}

function base(content: string) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OWISE</title></head>
<body style="margin:0;padding:0;background:#F4F2EE;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <!-- Header -->
  <tr><td style="background:#09091A;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
    <div style="display:inline-block;width:36px;height:36px;background:linear-gradient(135deg,#C9A84C,#8B6A1A);border-radius:8px;line-height:36px;text-align:center;font-size:20px;font-weight:600;color:#09091A;font-family:Georgia,serif;vertical-align:middle;margin-right:10px;">O</div>
    <span style="font-family:Georgia,serif;font-size:22px;font-weight:500;letter-spacing:.12em;color:#EDE8DF;vertical-align:middle;">OWISE</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px 32px 24px;">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#F4F2EE;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;border-top:1px solid #E8E4DC;">
    <p style="margin:0;font-size:11px;color:#848499;">OWISE · Service VTC · Paris & Île-de-France<br>
    <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;width:140px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#1a1a2e;font-weight:500;">${value}</td>
  </tr>`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── 0a. Bienvenue — nouveau client ───────────────────────────────────────────

export async function envoyerBienvenueClient(params: {
  email: string
  prenom: string
  nom: string
  password: string
  typeCompte: string
  entrepriseNom?: string | null
}) {
  const { email, prenom, nom, password, typeCompte, entrepriseNom } = params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const isEntreprise = typeCompte === 'entreprise'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Bienvenue chez OWISE 🎉</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom}, votre espace client${isEntreprise && entrepriseNom ? ` <strong style="color:#09091A">${entrepriseNom}</strong>` : ''} a été créé.<br>
      Vous pouvez dès maintenant réserver vos transferts VTC en ligne.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Vos identifiants de connexion</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Email', email)}
        ${row('Mot de passe', password)}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#AAAAAA;">Vous pouvez modifier votre mot de passe depuis votre espace client.</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${siteUrl}/client-login"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Accéder à mon espace →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Des questions ? Contactez-nous : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  await send(email, 'Bienvenue chez OWISE — Vos accès client', html)
}

// ── 0b. Bienvenue — nouveau collaborateur ─────────────────────────────────────

export async function envoyerBienvenueCollaborateur(params: {
  email: string
  prenom: string
  nom: string
  password: string
  entrepriseNom: string
  poste?: string | null
}) {
  const { email, prenom, nom, password, entrepriseNom, poste } = params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre accès OWISE est prêt</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom},<br>
      Vous avez été ajouté(e) comme collaborateur${poste ? ` <strong style="color:#09091A">${poste}</strong>` : ''} pour le compte <strong style="color:#09091A">${entrepriseNom}</strong>.<br>
      Vous pouvez désormais réserver des transferts VTC depuis votre espace personnel.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Vos identifiants de connexion</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Email', email)}
        ${row('Mot de passe', password)}
        ${row('Compte', entrepriseNom)}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#AAAAAA;">Vous pouvez modifier votre mot de passe depuis votre espace.</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${siteUrl}/client-login"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Accéder à mon espace →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Des questions ? <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  await send(email, `Votre accès OWISE — ${entrepriseNom}`, html)
}

// ── 0c. Bienvenue — nouveau chauffeur ─────────────────────────────────────────

export async function envoyerBienvenueChauffeur(params: {
  email: string
  prenom: string
  nom: string
  password: string
  typeContrat: string
  vehicule?: string | null
}) {
  const { email, prenom, nom, password, typeContrat, vehicule } = params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Bienvenue dans l'équipe OWISE</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom}, votre compte chauffeur a été activé.<br>
      Vous pouvez maintenant vous connecter à l'application et recevoir des courses.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Vos identifiants de connexion</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Email', email)}
        ${row('Mot de passe', password)}
        ${row('Contrat', typeContrat === 'salarie' ? 'Salarié' : 'Sous-traitant')}
        ${vehicule ? row('Véhicule', vehicule) : ''}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${siteUrl}/chauffeur"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Accéder à l'app chauffeur →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Questions ? <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  await send(email, 'Bienvenue chez OWISE — Votre compte chauffeur', html)
}

// ── 1. Confirmation client ───────────────────────────────────────────────────

export async function envoyerConfirmationClient(params: {
  clientEmail: string
  clientPrenom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  typeVehicule: string
  nbPassagers: number
  prixEstime?: number | null
  refCourse: string
  /**
   * Trajet retour, quand la réservation est un aller-retour. Sans lui, le client
   * recevait une confirmation ne mentionnant que l'aller alors que deux courses
   * étaient bien enregistrées — il ignorait que son retour était réservé.
   */
  retour?: { datePrevue: string; adresseArrivee?: string } | null
  /** Message affiché en tête, pour une confirmation qui en remplace une précédente. */
  note?: string
  /** false pour un collaborateur d'entreprise : le montant ne le regarde pas. */
  afficherPrix?: boolean
  /** Arrêts en chemin, à l'aller — le client doit pouvoir vérifier l'adresse. */
  etapes?: string[] | null
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, typeVehicule, nbPassagers, refCourse, retour, note, etapes } = params
  const arrets = (etapes ?? []).filter(e => e?.trim())
  const lignesArrets = arrets.map((e, i) => row(`Arrêt ${arrets.length > 1 ? i + 1 : ''}`.trim(), e)).join('')
  // Prix masqué : on neutralise la valeur au lieu de la tester partout, pour
  // qu'aucun futur ajout de ligne tarifaire ne la laisse filtrer par oubli.
  const prixEstime = params.afficherPrix === false ? null : params.prixEstime

  // `arrets` n'apparaît qu'au trajet où l'arrêt a lieu : l'aller.
  const bloc = (titre: string, date: string, depart: string, arrivee: string, arretsBloc = '') => `
    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:14px;">
      ${titre ? `<div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#C9A84C;font-weight:600;margin-bottom:12px;">${titre}</div>` : ''}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Date', fmtDate(date))}
        ${row('Heure', fmtTime(date))}
        ${row('Départ', depart)}
        ${arretsBloc}
        ${row('Arrivée', arrivee)}
        ${prixEstime ? row('Tarif estimé', `${prixEstime.toFixed(2)} €`) : ''}
      </table>
    </div>`

  const corps = retour
    ? `
      <div style="background:#F8F6F1;border-radius:10px;padding:16px 24px;margin-bottom:14px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Référence', `#${refCourse}`)}
          ${row('Véhicule', typeVehicule)}
          ${row('Passagers', String(nbPassagers))}
        </table>
      </div>
      ${bloc('Trajet aller', datePrevue, adresseDepart, adresseArrivee, lignesArrets)}
      ${bloc('Trajet retour', retour.datePrevue, adresseArrivee, retour.adresseArrivee || adresseDepart)}
      ${prixEstime ? `
      <div style="background:#09091A;border-radius:10px;padding:16px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#EDE8DF;">Total aller-retour</td>
          <td align="right" style="font-size:18px;color:#C9A84C;font-weight:600;">${(prixEstime * 2).toFixed(2)} €</td>
        </tr></table>
      </div>` : ''}`
    : `
      <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Référence', `#${refCourse}`)}
          ${row('Date', fmtDate(datePrevue))}
          ${row('Heure', fmtTime(datePrevue))}
          ${row('Départ', adresseDepart)}
          ${lignesArrets}
          ${row('Arrivée', adresseArrivee)}
          ${row('Véhicule', typeVehicule)}
          ${row('Passagers', String(nbPassagers))}
          ${prixEstime ? row('Tarif estimé', `${prixEstime.toFixed(2)} €`) : ''}
        </table>
      </div>`

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">${retour ? 'Votre aller-retour est confirmé' : 'Votre course est confirmée'}</h2>
    <p style="margin:0 0 ${note ? '16' : '24'}px;font-size:14px;color:#848499;">Bonjour ${clientPrenom}, voici le récapitulatif de votre réservation.</p>
    ${note ? `<div style="margin:0 0 24px;padding:12px 16px;border-radius:8px;background:#FDF6E3;border:1px solid rgba(201,168,76,.35);font-size:13px;color:#6B5518;line-height:1.55;">${note}</div>` : ''}
    ${corps}
    <p style="margin:0 0 8px;font-size:13px;color:#555;">Votre chauffeur vous sera communiqué avant la prise en charge.</p>
    <p style="margin:0;font-size:12px;color:#848499;">Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  `)

  const sujet = retour
    ? `Confirmation aller-retour – ${fmtDate(datePrevue)} et ${fmtDate(retour.datePrevue)}`
    : `Confirmation de course – ${fmtDate(datePrevue)} à ${fmtTime(datePrevue)}`

  await send(clientEmail, sujet, html)
}

// ── 1b. Lien de paiement — réservation prise par téléphone/WhatsApp ──────────

export async function envoyerLienPaiement(params: {
  clientEmail: string
  clientPrenom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  prix: number
  lienPaiement: string
  refCourse: string
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, prix, lienPaiement, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Réglez votre course</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${clientPrenom}, voici le lien pour régler votre course en ligne, en toute sécurité.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
        ${row('Montant', `${prix.toFixed(2)} €`)}
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${lienPaiement}" style="display:inline-block;padding:14px 32px;border-radius:8px;background:#C9A84C;color:#09091A;font-weight:600;font-size:14px;text-decoration:none;">Payer ${prix.toFixed(2)} € →</a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:12px;color:#848499;">Paiement sécurisé par Stripe. Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  `)

  await send(clientEmail, `Lien de paiement – course #${refCourse}`, html)
}

// ── 2b. Notification société sous-traitante — course assignée à l'un de ses chauffeurs ──

export async function envoyerNotificationST(params: {
  stEmail: string
  stNom: string
  contactNom: string | null
  chauffeurPrenom?: string | null
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  refCourse: string
}) {
  const { stEmail, stNom, contactNom, chauffeurPrenom, adresseDepart, adresseArrivee, datePrevue, refCourse } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Nouvelle course assignée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour${contactNom ? ` ${contactNom}` : ''}, ${chauffeurPrenom
        ? `une course OWISE vient d'être confiée à l'un de vos chauffeurs.`
        : `votre société a été sélectionnée pour réaliser une course OWISE.`}
    </p>
    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${chauffeurPrenom ? row('Chauffeur', chauffeurPrenom) : ''}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
      </table>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;">
      Questions : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  await send(stEmail, `[OWISE] Course #${refCourse} – ${fmtDate(datePrevue)} à ${fmtTime(datePrevue)}`, html)
}

// ── 2. Notification chauffeur assigné ────────────────────────────────────────

export async function envoyerNotificationChauffeur(params: {
  chauffeurEmail: string
  chauffeurPrenom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  clientNom: string
  clientTel?: string | null
  nbPassagers: number
  notes?: string | null
  refCourse: string
  /** Arrêts en chemin — payés par le client, donc dus par le chauffeur. */
  etapes?: string[] | null
}) {
  const { chauffeurEmail, chauffeurPrenom, adresseDepart, adresseArrivee, datePrevue, clientNom, clientTel, nbPassagers, notes, refCourse, etapes } = params
  const arrets = (etapes ?? []).filter(e => e?.trim())

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Nouvelle course assignée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${chauffeurPrenom}, une course vous a été assignée.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${arrets.map((e, i) => row(`Arrêt ${arrets.length > 1 ? i + 1 : ''}`.trim(), e)).join('')}
        ${row('Arrivée', adresseArrivee)}
        ${row('Client', clientNom)}
        ${clientTel ? row('Tél. client', clientTel) : ''}
        ${row('Passagers', String(nbPassagers))}
        ${notes ? row('Notes', notes) : ''}
      </table>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;">Connectez-vous à l'app chauffeur pour gérer cette course.</p>
  `)

  await send(chauffeurEmail, `Course #${refCourse} – ${fmtDate(datePrevue)} à ${fmtTime(datePrevue)}`, html)
}

// ── 3b. Notification client — chauffeur assigné ──────────────────────────────

export async function envoyerChauffeurAssigne(params: {
  clientEmail: string
  clientPrenom: string
  chauffeurPrenom: string
  chauffeurNom: string
  adresseDepart: string
  datePrevue: string
  refCourse: string
}) {
  const { clientEmail, clientPrenom, chauffeurPrenom, chauffeurNom, adresseDepart, datePrevue, refCourse } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre chauffeur est confirmé</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${clientPrenom}, votre course est prise en charge.</p>
    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Chauffeur', `${chauffeurPrenom} ${chauffeurNom}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
      </table>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;">Votre chauffeur sera à l'heure prévue. Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  `)
  await send(clientEmail, `Votre chauffeur est confirmé – Course #${refCourse}`, html)
}

// ── 3c. Notification admin — chauffeur a refusé ───────────────────────────────

export async function envoyerRefusChauffeur(params: {
  chauffeurNom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  refCourse: string
}) {
  const { chauffeurNom, adresseDepart, adresseArrivee, datePrevue, refCourse } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Course refusée par le chauffeur</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;"><strong>${chauffeurNom}</strong> a refusé la course suivante. Elle est de nouveau en attente d'attribution.</p>
    <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
      </table>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'}/admin/courses"
       style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">
      Réassigner dans l'admin →
    </a>
  `)
  await send(ADMIN_EMAIL, `[OWISE] Course #${refCourse} refusée — à réassigner`, html)
}

// ── 3. Notification admin (nouvelle course) ──────────────────────────────────

export async function envoyerNotificationAdmin(params: {
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  clientNom: string
  typeVehicule: string
  refCourse: string
}) {
  const { adresseDepart, adresseArrivee, datePrevue, clientNom, typeVehicule, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Nouvelle course créée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Une nouvelle course vient d'être enregistrée.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Client', clientNom)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
        ${row('Véhicule', typeVehicule)}
      </table>
    </div>

    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/admin/courses"
       style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">
      Voir dans l'admin →
    </a>
  `)

  await send(ADMIN_EMAIL, `[OWISE] Nouvelle course #${refCourse} – ${clientNom}`, html)
}

// ── 4. Reçu de fin de course ─────────────────────────────────────────────────

export async function envoyerRecuClient(params: {
  clientEmail: string
  clientPrenom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  prixFinal: number
  chauffeurNom?: string
  refCourse: string
  codeParrainage?: string | null
  /** false pour un collaborateur d'entreprise : le montant ne le regarde pas. */
  afficherPrix?: boolean
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, prixFinal, chauffeurNom, refCourse, codeParrainage } = params
  const afficherPrix = params.afficherPrix !== false

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre course est terminée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Merci de votre confiance, ${clientPrenom}. Voici votre reçu.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
        ${chauffeurNom ? row('Chauffeur', chauffeurNom) : ''}
      </table>
    </div>

    ${afficherPrix ? `
    <div style="background:#09091A;border-radius:10px;padding:16px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Montant</div>
      <div style="font-size:32px;font-weight:700;color:#C9A84C;font-family:'Courier New',monospace;">${prixFinal.toFixed(2)} €</div>
    </div>` : `
    <div style="background:#F8F6F1;border-radius:10px;padding:14px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:#848499;">Cette course est facturée à votre entreprise.</div>
    </div>`}

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:20px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
      <div style="font-size:15px;font-weight:600;color:#09091A;margin-bottom:6px;">Votre avis compte pour nous</div>
      <div style="font-size:13px;color:#848499;margin-bottom:16px;">Votre trajet s'est bien passé ? Laissez un avis Google — cela prend 30 secondes et aide d'autres voyageurs à nous trouver.</div>
      <a href="${GOOGLE_REVIEW_URL}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.02em;">
        Laisser un avis Google →
      </a>
      <div style="margin-top:16px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(GOOGLE_REVIEW_URL)}&bgcolor=ffffff&color=09091A&margin=4"
             alt="QR code avis Google" width="120" height="120"
             style="display:block;margin:0 auto;border-radius:8px;" />
        <div style="font-size:10px;color:#848499;margin-top:6px;">Scanner pour laisser un avis</div>
      </div>
    </div>

    ${codeParrainage ? `
    <div style="background:#F8F6F1;border:1px solid #C9A84C33;border-radius:10px;padding:18px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:14px;font-weight:600;color:#09091A;margin-bottom:6px;">Parrainez vos proches, gagnez 10 €</div>
      <div style="font-size:12.5px;color:#848499;margin-bottom:12px;">Partagez votre code : ils bénéficient de -10% sur leur 1ère course, vous recevez 10€ de crédit dès leur paiement.</div>
      <div style="display:inline-block;background:#09091A;color:#C9A84C;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:.15em;padding:8px 18px;border-radius:8px;">${codeParrainage}</div>
    </div>` : ''}

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">À bientôt sur OWISE — <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a></p>
  `)

  // Le montant figurait aussi dans l'objet : visible dans la liste des mails
  // sans même ouvrir, ce qui annulait le masquage fait dans le corps.
  await send(
    clientEmail,
    afficherPrix ? `Reçu course #${refCourse} – ${prixFinal.toFixed(2)} €` : `Reçu de votre course #${refCourse}`,
    html,
  )
}

// ── 5. Demande d'avis Google (clients entreprise — pas de reçu auto) ─────────

export async function envoyerDemandeAvis(params: {
  clientEmail: string
  clientPrenom: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  refCourse: string
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Merci pour votre confiance</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Votre course #${refCourse} vient de se terminer, ${clientPrenom}.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Date', fmtDate(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
      </table>
    </div>

    <div style="background:#09091A;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:24px;margin-bottom:10px;">⭐⭐⭐⭐⭐</div>
      <div style="font-size:16px;font-weight:600;color:#EDE8DF;margin-bottom:6px;">Votre avis nous aide à grandir</div>
      <div style="font-size:13px;color:#848499;margin-bottom:18px;">
        Avez-vous été satisfait de votre chauffeur ?<br>
        Laissez un avis Google — c'est rapide et ça fait vraiment la différence.
      </div>
      <a href="${GOOGLE_REVIEW_URL}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:13px 30px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Laisser un avis Google →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Merci d'utiliser OWISE — <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a>
    </p>
  `)

  await send(clientEmail, `Merci pour votre course #${refCourse} – Votre avis compte !`, html)
}

// ── 6. Lien de paiement facture ──────────────────────────────────────────────

export async function envoyerLienPaiementClient(params: {
  clientEmail: string
  clientPrenom: string
  numeroFacture: string
  montantTTC: number
  dateEcheance: string | null
  lienPaiement: string
}) {
  const { clientEmail, clientPrenom, numeroFacture, montantTTC, dateEcheance, lienPaiement } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre facture est disponible</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${clientPrenom}, veuillez trouver ci-dessous votre facture OWISE.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Facture', numeroFacture)}
        ${row('Montant TTC', `${montantTTC.toFixed(2)} €`)}
        ${dateEcheance ? row('Échéance', fmtDate(dateEcheance)) : ''}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${lienPaiement}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Payer ma facture →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Paiement sécurisé par <strong>Stripe</strong>. Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)

  await send(clientEmail, `Facture ${numeroFacture} – ${montantTTC.toFixed(2)} € à régler`, html)
}

// ── 5b. Nouvelle facture auto-générée ────────────────────────────────────────

export async function envoyerNouvelleFacture(params: {
  clientEmail: string
  clientNom: string
  factureNumero: string
  montantHt: number
  montantTtc: number
  tauxTva: number
  dateEcheance: string
  refCourse: string
  lienFacture: string
  /** Facture émise après encaissement : on n'annonce pas une échéance déjà réglée. */
  dejaReglee?: boolean
  modePaiement?: string | null
  /**
   * Identifiant de la facture. Fourni, la facture est jointe au message en PDF.
   * Sans lui, le client ne dispose que du lien vers l'espace client — inutile
   * pour qui ne se connectera jamais (réservation prise par téléphone).
   */
  factureId?: string
}) {
  const { clientEmail, clientNom, factureNumero, montantHt, montantTtc, tauxTva, dateEcheance, refCourse, lienFacture, dejaReglee, modePaiement, factureId } = params
  const tva = montantTtc - montantHt
  const tauxLabel = (tauxTva % 1 === 0 ? String(tauxTva) : tauxTva.toFixed(1)).replace('.', ',')
  const MODE_LABEL: Record<string, string> = {
    tpe_bord: 'carte bancaire à bord',
    especes:  'espèces',
    virement: 'virement',
    cheque:   'chèque',
    stripe:   'paiement en ligne',
  }
  const regle = dejaReglee
    ? `Réglée${modePaiement ? ` par ${MODE_LABEL[modePaiement] ?? modePaiement}` : ''}`
    : null

  // La facture en pièce jointe : c'est elle le justificatif. Un échec de
  // génération ne doit jamais empêcher l'envoi du message lui-même, mais il
  // doit laisser une trace — sinon le client reçoit un mail muet et personne
  // ne le sait.
  let pieceJointe: PieceJointe | null = null
  if (factureId) {
    try {
      const pdf = await genererFacturePdf(factureId)
      if (pdf) pieceJointe = { filename: pdf.nomFichier, content: Buffer.from(pdf.contenu) }
      else console.error(`[FACTURE PDF] facture introuvable : ${factureId}`)
    } catch (e) {
      console.error(`[FACTURE PDF] génération impossible pour ${factureId} :`, e)
    }
  }

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre facture OWISE</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${clientNom},<br>
      ${dejaReglee
        ? 'Voici votre facture, déjà réglée. Aucun paiement n\'est attendu de votre part — ce document vous sert de justificatif.'
        : 'Suite à votre course, voici votre facture. Elle est disponible dans votre espace client.'}
      ${pieceJointe ? '<br><strong style="color:#09091A">Elle est jointe à ce message au format PDF</strong>, vous n\'avez rien à installer ni aucun compte à ouvrir pour la lire.' : ''}
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Facture', factureNumero)}
        ${row('Course', `#${refCourse}`)}
        ${row('Montant HT', formaterMontant(montantHt))}
        ${row(`TVA (${tauxLabel}%)`, formaterMontant(tva))}
        ${row('Montant TTC', `<strong style="color:#09091A">${formaterMontant(montantTtc)}</strong>`)}
        ${regle
          ? row('Statut', `<strong style="color:#3DB87A">${regle}</strong>`)
          : row('Échéance', fmtDate(dateEcheance))}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${lienFacture}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Voir ma facture →
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Questions : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  // Le sujet dit l'essentiel sans ouvrir : une facture acquittée n'appelle
  // aucune action du client.
  await send(clientEmail,
    dejaReglee
      ? `Facture ${factureNumero} – ${formaterMontant(montantTtc)} TTC – réglée`
      : `Facture ${factureNumero} – ${formaterMontant(montantTtc)} TTC`,
    html,
    pieceJointe ? [pieceJointe] : undefined)
}

// ── 5c. Relance facture en retard ─────────────────────────────────────────────

export async function envoyerRelanceFacture(params: {
  clientEmail: string
  clientNom: string
  factureNumero: string
  montantTtc: number
  dateEcheance: string
  joursRetard: number
  lienFacture: string
}) {
  const { clientEmail, clientNom, factureNumero, montantTtc, dateEcheance, joursRetard, lienFacture } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#D95454;font-weight:600;">Facture en attente de règlement</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${clientNom},<br>
      Nous n'avons pas encore reçu le règlement de la facture ci-dessous, échue depuis <strong style="color:#D95454">${joursRetard} jour${joursRetard > 1 ? 's' : ''}</strong>.
    </p>

    <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Facture', factureNumero)}
        ${row('Montant TTC', `<strong style="color:#D95454">${montantTtc.toFixed(2)} €</strong>`)}
        ${row('Échéance', fmtDate(dateEcheance))}
        ${row('Retard', `${joursRetard} jour${joursRetard > 1 ? 's' : ''}`)}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${lienFacture}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Régler ma facture →
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Pour tout arrangement : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)
  await send(clientEmail, `[Relance] Facture ${factureNumero} – ${montantTtc.toFixed(2)} € en retard de ${joursRetard}j`, html)
}

// ── 5d. Rappel interne — factures sous-traitants en attente depuis longtemps ─
//
// Contrairement à envoyerRelanceFacture (envoyée AU client qui nous doit de
// l'argent), ici c'est nous qui devons payer le sous-traitant — l'email va
// donc à l'admin, pas au sous-traitant, pour ne pas oublier de régler.

export async function envoyerRappelFacturesST(params: {
  factures: Array<{ stNom: string; periode: string; montantHt: number; jours: number }>
  totalDu: number
}) {
  const { factures, totalDu } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Factures sous-traitants en attente</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      ${factures.length} facture${factures.length > 1 ? 's' : ''} sous-traitant${factures.length > 1 ? 's' : ''} en attente de règlement depuis plus de 14 jours, pour un total de <strong style="color:#09091A">${totalDu.toFixed(2)} €</strong>.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${factures.map(f => row(f.stNom, `${f.montantHt.toFixed(2)} € · ${f.periode} · en attente depuis ${f.jours}j`)).join('')}
      </table>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'}/admin/facturation/sous-traitants"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;">
        Voir et régler →
      </a>
    </div>
  `)

  await send(ADMIN_EMAIL, `[OWISE] ${factures.length} facture${factures.length > 1 ? 's' : ''} sous-traitant${factures.length > 1 ? 's' : ''} en attente – ${totalDu.toFixed(2)} €`, html)
}

// ── 6b. Réinitialisation mot de passe ────────────────────────────────────────

export async function envoyerResetPassword(params: { email: string; lien: string }) {
  const { email, lien } = params
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Réinitialisation de votre mot de passe</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Vous avez demandé à réinitialiser votre mot de passe OWISE.<br>
      Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${lien}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Réinitialiser mon mot de passe →
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
    </p>
  `)
  await send(email, 'Réinitialisation de votre mot de passe OWISE', html)
}

// ── 5d. Nouveau devis vitrine ─────────────────────────────────────────────────

export async function envoyerNouveauDevis(params: {
  nom: string
  tel: string
  email: string
  societe?: string | null
  origin: string
  destination: string
  date_course?: string | null
  heure?: string | null
  pax: number
  vehicle: string
  price?: number | null
  supplements?: string[] | null
  dest_type?: string | null
}) {
  const { nom, tel, email, societe, origin, destination, date_course, heure, pax, vehicle, price, supplements } = params

  // Email admin
  const htmlAdmin = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Nouveau devis reçu 📋</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Un visiteur vient de soumettre une demande de devis sur <strong>owise.fr</strong>.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Contact</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Nom', nom)}
        ${row('Téléphone', tel)}
        ${row('Email', email)}
        ${societe ? row('Société', societe) : ''}
      </table>
    </div>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Trajet</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Départ', origin)}
        ${row('Destination', destination)}
        ${date_course ? row('Date', fmtDate(date_course)) : ''}
        ${heure ? row('Heure', heure) : ''}
        ${row('Passagers', String(pax))}
        ${row('Véhicule', vehicle)}
        ${price ? row('Estimation', `${price} €`) : ''}
        ${supplements?.length ? row('Suppléments', supplements.join(', ')) : ''}
      </table>
    </div>

    <div style="background:#09091A;border-radius:10px;padding:16px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;">À rappeler dès que possible</p>
      <a href="tel:${tel}" style="font-size:24px;font-weight:700;color:#C9A84C;text-decoration:none;font-family:'Courier New',monospace;">${tel}</a>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'}/admin"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.02em;">
        Voir dans l'admin →
      </a>
    </div>
  `)
  await send(ADMIN_EMAIL, `[OWISE] Nouveau devis — ${nom}${societe ? ` (${societe})` : ''} · ${origin} → ${destination}`, htmlAdmin)

  // Accusé réception au client
  const htmlClient = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre demande de devis a bien été reçue</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${nom.split(' ')[0]},<br>
      Nous avons bien reçu votre demande de devis. Notre équipe vous recontactera dans les plus brefs délais, généralement sous <strong style="color:#09091A">2 heures</strong> en journée.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Votre demande</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Départ', origin)}
        ${row('Destination', destination)}
        ${date_course ? row('Date', fmtDate(date_course)) : ''}
        ${heure ? row('Heure', heure) : ''}
        ${row('Passagers', String(pax))}
        ${row('Véhicule', vehicle)}
        ${price ? row('Estimation indicative', `${price} €`) : ''}
      </table>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#555;text-align:center;">
      Besoin d'une réponse urgente ?
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://wa.me/33619106356"
         style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.02em;margin-right:10px;">
        WhatsApp →
      </a>
      <a href="tel:+33619106356"
         style="display:inline-block;background:#09091A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.02em;">
        Appeler →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">
      OWISE · Service VTC · Paris & Île-de-France<br>
      <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a>
    </p>
  `)
  await send(email, 'OWISE — Votre demande de devis a bien été reçue', htmlClient)
}

// ── 7. Relances devis non-convertis (séquence J+1 / J+4 / J+7) ──────────────

export async function envoyerRelanceDevisJ1(params: {
  email: string
  nom: string
  origin: string
  destination: string
  price?: number | null
  vehicle?: string | null
  date_course?: string | null
}) {
  const { email, nom, origin, destination, price, vehicle, date_course } = params
  const prenom = nom.split(' ')[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre trajet est toujours disponible</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom},<br>
      Vous avez demandé un tarif hier pour votre transfert VTC.<br>
      Votre estimation est toujours valable — réservez en 2 minutes, avant que votre créneau ne soit pris.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#848499;font-weight:600;">Votre trajet</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Départ', origin)}
        ${row('Arrivée', destination)}
        ${date_course ? row('Date', fmtDate(date_course)) : ''}
        ${vehicle ? row('Véhicule', vehicle) : ''}
        ${price ? row('Estimation', `<strong style="color:#09091A">${price} €</strong> tarif fixe garanti`) : ''}
      </table>
    </div>

    <div style="background:#09091A;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#848499;">Tarif fixe · Suivi de vol · Disponible 24h/24</p>
      <p style="margin:0 0 16px;font-size:13px;color:#EDE8DF;">Pas de compteur, pas de surprise. Le prix affiché est le prix payé.</p>
      <a href="${siteUrl}/reserver"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Réserver maintenant →
      </a>
    </div>

    <p style="margin:0 0 12px;font-size:12px;color:#848499;text-align:center;">
      Une question ? <a href="https://wa.me/33619106356" style="color:#25D366;">WhatsApp</a>
      ou <a href="tel:+33619106356" style="color:#C9A84C;">06 19 10 63 56</a>
    </p>
    <p style="margin:0;font-size:11px;color:#CCCCCC;text-align:center;">
      Vous ne souhaitez plus recevoir nos emails ?
      <a href="${siteUrl}/api/desinscription?email=${encodeURIComponent(email)}" style="color:#C9A84C;">Se désinscrire</a>
    </p>
  `)
  await send(email, `${prenom}, votre VTC ${origin.split(',')[0]} → ${destination.split(',')[0]} est disponible`, html)
}

export async function envoyerRelanceDevisJ4(params: {
  email: string
  nom: string
  origin: string
  destination: string
  price?: number | null
  date_course?: string | null
}) {
  const { email, nom, origin, destination, price, date_course } = params
  const prenom = nom.split(' ')[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre transfert VTC — avez-vous trouvé une solution ?</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom},<br>
      Vous avez consulté nos tarifs il y a quelques jours pour ${origin.split(',')[0]} → ${destination.split(',')[0]}.
      Si vous n'avez pas encore réservé, nous sommes toujours disponibles.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#09091A;">Pourquoi choisir Owise ?</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Tarif fixe', 'Prix garanti à la réservation, jamais de compteur')}
        ${row('Suivi de vol', 'Votre chauffeur s\'adapte si votre vol est retardé')}
        ${row('Ponctualité', '100% des clients satisfaits · 5⭐ sur Google')}
        ${row('Disponibilité', '24h/24, 7j/7, départs très tôt le matin')}
        ${price ? row('Votre estimation', `${price} € en berline`) : ''}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${siteUrl}/reserver"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.02em;">
        Confirmer ma réservation →
      </a>
    </div>

    <p style="margin:0 0 12px;font-size:12px;color:#848499;text-align:center;">
      Vous préférez appeler ? <a href="tel:+33619106356" style="color:#C9A84C;">06 19 10 63 56</a>
    </p>
    <p style="margin:0;font-size:11px;color:#CCCCCC;text-align:center;">
      Vous ne souhaitez plus recevoir nos emails ?
      <a href="${siteUrl}/api/desinscription?email=${encodeURIComponent(email)}" style="color:#C9A84C;">Se désinscrire</a>
    </p>
  `)
  await send(email, `Owise — Avez-vous trouvé un VTC pour ${destination.split(',')[0]} ?`, html)
}

export async function envoyerRelanceDevisJ7(params: {
  email: string
  nom: string
  origin: string
  destination: string
  price?: number | null
}) {
  const { email, nom, origin, destination, price } = params
  const prenom = nom.split(' ')[0]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Un dernier mot de la part d'Owise</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${prenom},<br>
      Il y a une semaine, vous nous avez contactés pour un transfert VTC.<br>
      C'est notre dernier message — nous ne voulons pas vous importuner.
    </p>

    <div style="background:#09091A;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#848499;text-transform:uppercase;letter-spacing:.1em;">Pour vous, une offre directe</p>
      <p style="margin:0 0 16px;font-size:16px;color:#EDE8DF;font-weight:600;">
        ${origin.split(',')[0]} → ${destination.split(',')[0]}
        ${price ? `<br><span style="color:#C9A84C;font-size:22px;">${price} €</span> tarif fixe` : ''}
      </p>
      <p style="margin:0 0 20px;font-size:13px;color:#848499;">
        Réservez via WhatsApp ou téléphone — nous confirmons immédiatement.
      </p>
      <a href="https://wa.me/33619106356?text=Bonjour%2C%20je%20voudrais%20réserver%20un%20VTC%20${encodeURIComponent(origin.split(',')[0])}%20vers%20${encodeURIComponent(destination.split(',')[0])}"
         style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:10px;">
        Réserver via WhatsApp →
      </a>
      <br>
      <a href="${siteUrl}/reserver"
         style="display:inline-block;background:transparent;color:#EDE8DF;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;border:1px solid rgba(237,232,223,.2);">
        Réserver en ligne →
      </a>
    </div>

    <p style="margin:0;font-size:11px;color:#CCCCCC;text-align:center;">
      Vous ne souhaitez plus recevoir nos emails ?
      <a href="${siteUrl}/api/desinscription?email=${encodeURIComponent(email)}" style="color:#C9A84C;">Se désinscrire</a>
    </p>
  `)
  await send(email, `Owise — Dernière chance pour votre transfert VTC`, html)
}

// ── 6. Annulation ────────────────────────────────────────────────────────────

export async function envoyerAnnulation(params: {
  destinataireEmail: string
  destinatairePrenom: string
  role: 'client' | 'chauffeur'
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  refCourse: string
}) {
  const { destinataireEmail, destinatairePrenom, role, adresseDepart, adresseArrivee, datePrevue, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Course annulée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      ${role === 'client'
        ? `Bonjour ${destinatairePrenom}, votre course du ${fmtDate(datePrevue)} a été annulée.`
        : `Bonjour ${destinatairePrenom}, la course du ${fmtDate(datePrevue)} qui vous était assignée a été annulée.`
      }
    </p>

    <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
      </table>
    </div>

    ${role === 'client' ? `<p style="margin:0;font-size:13px;color:#555;">Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>` : ''}
  `)

  await send(destinataireEmail, `Course annulée #${refCourse} – ${fmtDate(datePrevue)}`, html)
}

// ── 7. Infos course — chauffeur externe / sous-traitant (envoi manuel) ──────
//
// Le prix n'apparaît que si paiementABord est vrai — sinon le chauffeur
// externe n'a pas à connaître le tarif (paiement géré par la plateforme).

export async function envoyerInfosCourseEmail(params: InfosCourseParams & {
  destinataireEmail: string
  destinataireNom: string | null
}) {
  const {
    destinataireEmail, destinataireNom, ref, adresseDepart, adresseArrivee, etapes, datePrevue,
    nbPassagers, typeVehicule, numVolTrain, terminal, heureArriveeVol,
    passagerNom, passagerTel, notes, paiementABord, prix,
  } = params

  // Les arrêts intermédiaires manquaient à cet e-mail comme au message texte :
  // un chauffeur externe partait sans savoir qu'il devait s'arrêter en route.
  const arrets = (etapes ?? []).filter(e => e?.trim())

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Course à effectuer</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour${destinataireNom ? ` ${destinataireNom}` : ''}, voici les informations d'une course OWISE.
    </p>
    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${ref}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${arrets.map((e, i) => row(`Étape ${i + 1}`, e)).join('')}
        ${row('Arrivée', adresseArrivee)}
        ${row('Passagers', String(nbPassagers))}
        ${row('Véhicule', TYPE_VEHICULE_LABEL[typeVehicule])}
        ${numVolTrain ? row('Vol / Train', `${numVolTrain}${terminal ? ' — ' + terminal : ''}${heureArriveeVol ? ' — ' + heureArriveeVol : ''}`) : ''}
        ${passagerNom ? row('Client', `${passagerNom}${passagerTel ? ' — ' + passagerTel : ''}`) : ''}
        ${paiementABord && prix != null ? row('Montant à percevoir', `${prix.toFixed(2)} € (paiement à bord)`) : ''}
        ${notes ? row('Notes', notes) : ''}
      </table>
    </div>
    <p style="margin:0;font-size:12px;color:#848499;">
      Questions : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a>
    </p>
  `)

  await send(destinataireEmail, `[OWISE] Course #${ref} – ${fmtDate(datePrevue)} à ${fmtTime(datePrevue)}`, html)
}
