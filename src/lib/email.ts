import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'OWISE <noreply@owise.fr>'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'

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

    <p style="margin:0;font-size:12px;color:#848499;text-align:center;">À bientôt sur OWISE — <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a></p>
  `)

  await send(clientEmail, `Reçu course #${refCourse} – ${prixFinal.toFixed(2)} €`, html)
}

// ── 5. Annulation ────────────────────────────────────────────────────────────

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
