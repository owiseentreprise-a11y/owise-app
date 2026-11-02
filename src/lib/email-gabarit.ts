/**
 * L'enveloppe visuelle des e-mails d'Owise — en-tête, corps, pied de page.
 *
 * Elle vivait dans `email.ts`, qui tire Resend. L'écran qui montre le
 * brouillon d'un devis avant envoi a besoin du MÊME rendu : si l'aperçu
 * reconstruisait son propre gabarit, on validerait un message et on en
 * enverrait un autre. Le gabarit vit donc ici, sans aucune dépendance.
 */

export function base(content: string) {
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
    <p style="margin:0;font-size:11px;color:#848499;">OWISE · Service VTC · Paris &amp; Île-de-France<br>
    <a href="https://owise.fr" style="color:#C9A84C;text-decoration:none;">owise.fr</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

export function row(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:11px;color:#848499;text-transform:uppercase;letter-spacing:.1em;width:140px;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#1a1a2e;font-weight:500;">${value}</td>
  </tr>`
}

/**
 * Échappe ce qui vient de la base avant de l'insérer dans du HTML.
 *
 * Une adresse ou un nom de société peut contenir « & » ou « < » ; sans cela
 * le message se casse à l'affichage chez le destinataire.
 */
export function echapper(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
