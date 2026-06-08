import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'OWISE <noreply@owise.fr>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL ?? 'https://g.page/r/CjTmBFxmQWBREAE/review'

async function send(to: string, subject: string, html: string) {
  if (!resend) return
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
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
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, typeVehicule, nbPassagers, prixEstime, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre course est confirmée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${clientPrenom}, voici le récapitulatif de votre réservation.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
        ${row('Arrivée', adresseArrivee)}
        ${row('Véhicule', typeVehicule)}
        ${row('Passagers', String(nbPassagers))}
        ${prixEstime ? row('Tarif estimé', `${prixEstime.toFixed(2)} €`) : ''}
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:13px;color:#555;">Votre chauffeur vous sera communiqué avant la prise en charge.</p>
    <p style="margin:0;font-size:12px;color:#848499;">Pour toute question : <a href="mailto:${ADMIN_EMAIL}" style="color:#C9A84C;">${ADMIN_EMAIL}</a></p>
  `)

  await send(clientEmail, `Confirmation de course – ${fmtDate(datePrevue)} à ${fmtTime(datePrevue)}`, html)
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
}) {
  const { chauffeurEmail, chauffeurPrenom, adresseDepart, adresseArrivee, datePrevue, clientNom, clientTel, nbPassagers, notes, refCourse } = params

  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Nouvelle course assignée</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">Bonjour ${chauffeurPrenom}, une course vous a été assignée.</p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Référence', `#${refCourse}`)}
        ${row('Date', fmtDate(datePrevue))}
        ${row('Heure', fmtTime(datePrevue))}
        ${row('Départ', adresseDepart)}
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
}) {
  const { clientEmail, clientPrenom, adresseDepart, adresseArrivee, datePrevue, prixFinal, chauffeurNom, refCourse } = params

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

    <div style="background:#09091A;border-radius:10px;padding:16px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Montant</div>
      <div style="font-size:32px;font-weight:700;color:#C9A84C;font-family:'Courier New',monospace;">${prixFinal.toFixed(2)} €</div>
    </div>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:20px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
      <div style="font-size:15px;font-weight:600;color:#09091A;margin-bottom:6px;">Votre avis compte pour nous</div>
      <div style="font-size:13px;color:#848499;margin-bottom:16px;">Votre trajet s'est bien passé ? Laissez un avis Google — cela prend 30 secondes et aide d'autres voyageurs à nous trouver.</div>
      <a href="${GOOGLE_REVIEW_URL}"
         style="display:inline-block;background:#C9A84C;color:#09091A;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.02em;">
        Laisser un avis Google →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">À bientôt sur OWISE — <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a></p>
  `)

  await send(clientEmail, `Reçu course #${refCourse} – ${prixFinal.toFixed(2)} €`, html)
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
  dateEcheance: string
  refCourse: string
  lienFacture: string
}) {
  const { clientEmail, clientNom, factureNumero, montantHt, montantTtc, dateEcheance, refCourse, lienFacture } = params
  const tva = montantTtc - montantHt
  const html = base(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#09091A;font-weight:600;">Votre facture OWISE</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#848499;">
      Bonjour ${clientNom},<br>
      Suite à votre course, voici votre facture. Elle est disponible dans votre espace client.
    </p>

    <div style="background:#F8F6F1;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Facture', factureNumero)}
        ${row('Course', `#${refCourse}`)}
        ${row('Montant HT', `${montantHt.toFixed(2)} €`)}
        ${row('TVA (20%)', `${tva.toFixed(2)} €`)}
        ${row('Montant TTC', `<strong style="color:#09091A">${montantTtc.toFixed(2)} €</strong>`)}
        ${row('Échéance', fmtDate(dateEcheance))}
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
  await send(clientEmail, `Facture ${factureNumero} – ${montantTtc.toFixed(2)} € TTC`, html)
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
