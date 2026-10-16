/**
 * La facture telle qu'on la remet au client — prête à imprimer ou à
 * enregistrer en PDF depuis le navigateur.
 *
 * POURQUOI CETTE PAGE EXISTE
 *
 * Le PDF que le projet sait produire (`facture-pdf.ts`) est dessiné à la main
 * avec pdf-lib, en polices standard : il dit juste les montants, mais il ne
 * ressemble pas au document qu'Owise envoie réellement. La facture remise à
 * SKORP Production le 2026-10-16 avait été composée à part, en HTML, et
 * l'exploitant l'a validée telle quelle.
 *
 * Plutôt que de refaire ce dessin dans pdf-lib — long, fragile, et à
 * maintenir deux fois — cette page reprend exactement cette maquette et la
 * nourrit depuis la base. Elle vaut donc pour TOUTES les factures, pas pour
 * celle-là seulement : `Ctrl+P` → « Enregistrer au format PDF ».
 *
 * TOUT VIENT DE `chargerDocumentFacture()`, la source unique du contenu d'une
 * facture. Aucun libellé, aucun montant, aucune mention légale n'est réécrit
 * ici — la règle de CLAUDE.md tient : le document existe sous plusieurs
 * formes, il ne se définit qu'à un seul endroit.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { chargerDocumentFacture, formaterMontant } from '@/lib/facture-document'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const doc = await chargerDocumentFacture((await params).id)
  /* Le titre devient le nom du fichier PDF proposé par le navigateur. */
  return { title: doc ? `Facture ${doc.numero} — ${doc.client.nom}` : 'Facture', robots: { index: false } }
}

export default async function DocumentFacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let doc
  try {
    doc = await chargerDocumentFacture(id)
  } catch (e) {
    console.error('[facture/document] chargement impossible', id, e)
    throw e
  }
  if (!doc) {
    console.error('[facture/document] document vide pour', JSON.stringify(id))
    notFound()
  }

  const n = (i: number) => String(i + 1).padStart(2, '0')

  return (
    <>
      <style>{CSS}</style>

      <div className="fac-barre">
        <Link href={`/admin/facturation/${id}`} className="fac-retour">← Retour à la facture</Link>
        <span className="fac-aide">Ctrl+P puis « Enregistrer au format PDF »</span>
      </div>

      <div className="fac-feuille">

        <div className="fac-haut">
          <div className="fac-marque">
            <div className="fac-sceau">
              <svg width="26" height="26" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="15.4" fill="none" stroke="#09091A" strokeOpacity=".82" strokeWidth="2.4" />
                <path d="M28 12.6 A15.4 15.4 0 0 1 42 21.7" fill="none" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" />
                <circle cx="28" cy="28" r="3" fill="#C9A84C" />
              </svg>
            </div>
            <div>
              <div className="fac-nom">OWISE</div>
              <div className="fac-metier">{doc.prestataire.metier}</div>
            </div>
          </div>
          <div className="fac-coord">
            <b>{doc.prestataire.nom}</b><br />
            {doc.prestataire.telephone}<br />
            {doc.prestataire.email}<br />
            <span className="fac-mono">SIRET {doc.societe.siretGroupe ?? doc.societe.siret}</span>
          </div>
        </div>

        <div className="fac-titre-ligne">
          <div>
            <h1>Facture</h1>
            <div className="fac-numero">{doc.numero}</div>
          </div>
          <div className="fac-reperes">
            {doc.datePrestation && (
              <>Prestations réalisées le &nbsp; <b>{doc.datePrestation}</b><br /></>
            )}
            Facture émise le &nbsp; <b>{doc.dateEmissionCourte}</b><br />
            {doc.payee
              ? <>Statut &nbsp; <b>{doc.reglement}</b></>
              : <>Échéance &nbsp; <b>{doc.echeanceCourte}</b></>}
          </div>
        </div>

        <div className="fac-parties">
          <div className="fac-bloc">
            <div className="fac-etiquette">Prestataire</div>
            <p>
              <strong>{doc.prestataire.nom}</strong>
              {doc.prestataire.metier}<br />
              {doc.prestataire.telephone} · {doc.prestataire.email}
              <span className="fac-legal">
                {doc.prestataire.legal.map((l, i) => <span key={i}>{l}<br /></span>)}
              </span>
            </p>
          </div>
          <div className="fac-bloc">
            <div className="fac-etiquette">Client</div>
            <p>
              <strong>{doc.client.nom}</strong>
              {doc.client.contact && <>À l&apos;attention de {doc.client.contact}<br /></>}
              {doc.client.adresse && doc.client.adresse.split(',').map((m, i) => <span key={i}>{m.trim()}<br /></span>)}
              {doc.client.telephone && <>{doc.client.telephone}<br /></>}
              {doc.client.email}
            </p>
          </div>
        </div>

        <table className="fac-table">
          <caption>Prestations réalisées</caption>
          <thead>
            <tr>
              <th></th>
              <th>Trajet</th>
              <th className="fac-chiffre">Montant</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l, i) => (
              <tr key={i}>
                <td className="fac-rang">{n(i)}</td>
                <td>
                  <div className="fac-trajet">{l.depart} → {l.arrivee}</div>
                  {l.detail && <div className="fac-detail">{l.detail}</div>}
                </td>
                <td className="fac-chiffre">{formaterMontant(l.montantHt)}</td>
              </tr>
            ))}
            {doc.lignes.length === 0 && (
              <tr><td colSpan={3} className="fac-vide">Aucune course rattachée à cette facture.</td></tr>
            )}
          </tbody>
        </table>

        <div className="fac-bas">
          <div className="fac-reglement">
            <div className="fac-etiquette">Règlement</div>
            {doc.payee ? doc.reglement : `Par virement bancaire, sous ${doc.delaiPaiement} jours.`}
            {doc.banque?.iban && <span className="fac-mono">{doc.banque.iban}</span>}
            {doc.banque?.bic && <span className="fac-mono">BIC {doc.banque.bic}</span>}
          </div>

          <div>
            {doc.recap.map((r, i) => (
              <div className="fac-ligne" key={i}><span>{r.libelle}</span><span>{formaterMontant(r.montant)}</span></div>
            ))}
            <div className="fac-total">
              <span>{doc.payee ? 'Montant réglé' : 'Net à payer'}</span>
              <b>{formaterMontant(doc.montantTtc)}</b>
            </div>
          </div>
        </div>

        <footer className="fac-pied">
          {doc.tva === 0 && (
            <><b>TVA non applicable</b>, article 293 B du Code général des impôts — le montant indiqué est net de taxe.<br /></>
          )}
          En cas de retard de paiement : pénalités au taux légal en vigueur et indemnité forfaitaire
          pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce). Pas d&apos;escompte pour paiement anticipé.
          {doc.mentions && <><br />{doc.mentions}</>}
        </footer>

      </div>
    </>
  )
}

/* La maquette validée par l'exploitant le 2026-10-16. Les classes sont
 * préfixées « fac- » : cette page vit sous la mise en page d'administration,
 * dont les styles emploient des noms génériques (.bloc, .ligne, .total). */
const CSS = `
.fac-barre{
  display:flex; justify-content:space-between; align-items:center; gap:16px;
  padding:14px 22px; background:#FFFFFF; border-bottom:1px solid rgba(9,9,26,.08);
  font-family:var(--font-dm-sans),'DM Sans',sans-serif; font-size:13px;
}
.fac-retour{color:#C9A84C; text-decoration:none; font-weight:500}
.fac-retour:hover{text-decoration:underline}
.fac-retour:focus-visible{outline:2px solid #C9A84C; outline-offset:3px; border-radius:4px}
.fac-aide{color:#8A8A9A; font-size:12px}

.fac-feuille{
  --encre:#09091A; --encre-2:#4A4A60; --encre-3:#8A8A9A;
  --or:#C9A84C; --or-pale:rgba(201,168,76,.10); --or-trait:rgba(201,168,76,.28);
  --papier:#F8F6F1; --papier-2:#F1EDE4;
  max-width:760px; margin:28px auto 64px; background:var(--papier);
  padding:52px 56px 44px; border-radius:3px; color:var(--encre);
  font-family:var(--font-dm-sans),'DM Sans',system-ui,sans-serif; font-weight:300;
  box-shadow:0 1px 2px rgba(9,9,26,.08), 0 24px 60px -32px rgba(9,9,26,.35);
}
.fac-feuille *{box-sizing:border-box}

.fac-haut{display:flex; justify-content:space-between; align-items:flex-start; gap:32px}
.fac-marque{display:flex; align-items:center; gap:13px}
.fac-sceau{
  width:46px; height:46px; border-radius:11px; flex:none;
  background:var(--or-pale); border:1px solid var(--or-trait);
  display:grid; place-items:center;
}
.fac-nom{font-family:var(--font-cormorant),'Cormorant Garamond',serif; font-size:27px; font-weight:600; letter-spacing:.11em; line-height:1}
.fac-metier{font-size:9.5px; letter-spacing:.24em; text-transform:uppercase; color:var(--encre-3); margin-top:5px}
.fac-coord{text-align:right; font-size:11.5px; line-height:1.85; color:var(--encre-2)}
.fac-coord b{color:var(--encre); font-weight:500}

.fac-titre-ligne{
  display:flex; justify-content:space-between; align-items:flex-end; gap:30px;
  margin:38px 0 30px; padding-bottom:16px; border-bottom:1px solid var(--or-trait);
}
.fac-feuille h1{font-family:var(--font-cormorant),'Cormorant Garamond',serif; font-weight:500; font-size:36px; margin:0; letter-spacing:.01em}
.fac-numero{font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-size:14px; font-weight:500; color:var(--or); letter-spacing:.04em; margin-top:6px}
.fac-reperes{text-align:right; font-size:11.5px; line-height:1.9; color:var(--encre-3); white-space:nowrap}
.fac-reperes b{color:var(--encre); font-weight:500; font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-size:12px}

.fac-parties{display:grid; grid-template-columns:1fr 1fr; gap:26px; margin-bottom:34px}
.fac-bloc{background:var(--papier-2); border-radius:9px; padding:16px 18px}
.fac-etiquette{font-size:9.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--encre-3); margin-bottom:9px}
.fac-bloc p{margin:0; font-size:13px; line-height:1.75; color:var(--encre-2)}
.fac-bloc strong{display:block; color:var(--encre); font-weight:600; font-size:14.5px; margin-bottom:3px}
.fac-legal{font-size:11px; line-height:1.6; color:var(--encre-3); display:block; margin-top:5px}

.fac-table{width:100%; border-collapse:collapse}
.fac-table caption{text-align:left; font-size:9.5px; letter-spacing:.2em; text-transform:uppercase; color:var(--encre-3); padding-bottom:11px}
.fac-table th{text-align:left; font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--encre-3); font-weight:600; padding:0 0 9px; border-bottom:1px solid var(--or-trait)}
.fac-table th.fac-chiffre, .fac-table td.fac-chiffre{text-align:right}
.fac-table td{padding:14px 0; border-bottom:1px solid rgba(9,9,26,.07); vertical-align:top; font-size:13.5px}
.fac-table td.fac-rang{width:28px; color:var(--or); font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-size:11.5px; padding-top:16px}
.fac-trajet{font-weight:500; color:var(--encre)}
.fac-detail{font-size:12px; color:var(--encre-3); margin-top:3px; line-height:1.55}
.fac-table td.fac-chiffre{font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; font-weight:500; white-space:nowrap; padding-left:18px}
.fac-vide{color:var(--encre-3); font-size:12.5px; font-style:italic}

.fac-bas{display:grid; grid-template-columns:1fr 296px; gap:30px; margin-top:26px; align-items:start}
.fac-ligne{display:flex; justify-content:space-between; gap:16px; padding:6px 0; color:var(--encre-2); font-size:12.5px}
.fac-ligne span:last-child{font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-variant-numeric:tabular-nums}
.fac-total{
  display:flex; justify-content:space-between; align-items:baseline; gap:16px;
  margin-top:12px; padding:15px 18px; border-radius:9px;
  background:var(--encre); color:var(--papier);
}
.fac-total span:first-child{font-size:11px; letter-spacing:.16em; text-transform:uppercase; opacity:.72}
.fac-total b{font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-size:23px; font-weight:500; color:var(--or)}

.fac-reglement{font-size:12px; line-height:1.8; color:var(--encre-2)}
.fac-reglement .fac-etiquette{margin-bottom:7px}
.fac-mono{font-family:var(--font-jetbrains),'JetBrains Mono',monospace; letter-spacing:.02em; display:block; color:var(--encre); font-size:12.5px}

.fac-pied{margin-top:38px; padding-top:18px; border-top:1px solid var(--or-trait); font-size:10.5px; line-height:1.85; color:var(--encre-3)}
.fac-pied b{color:var(--encre-2); font-weight:500}

@media (max-width:640px){
  .fac-feuille{padding:32px 22px}
  .fac-haut,.fac-parties,.fac-bas,.fac-titre-ligne{grid-template-columns:1fr; flex-direction:column; align-items:flex-start}
  .fac-coord,.fac-reperes{text-align:left}
}

@media print{
  /* La mise en page d'administration enferme ses enfants dans une hauteur
     d'écran avec débordement masqué : à l'impression, tout ce qui dépasse la
     première page disparaîtrait. On la neutralise, et on retire la barre
     latérale, le bandeau cookies et la barre de retour. */
  .theme-light{display:block !important; height:auto !important; overflow:visible !important}
  .theme-light > main{overflow:visible !important; padding-bottom:0 !important; display:block !important}
  .theme-light > *:not(main){display:none !important}
  .fac-barre, .cookie-banner, .bandeau-cookies{display:none !important}

  /* La charte Owise interdit le blanc pur : la feuille entière reste crème.
     D'où une marge intérieure plutôt qu'une marge de page, sinon les bords du
     PDF seraient blancs et le fond crème flotterait au milieu. */
  html,body{background:#F8F6F1 !important; padding:0 !important; margin:0 !important}
  .fac-feuille{box-shadow:none; max-width:none; border-radius:0; padding:9mm 14mm; margin:0}
  @page{margin:0; size:A4}

  /* Resserrement réservé au papier : à l'écran le document reste aéré, mais
     sur A4 il débordait de 160 px — soit une deuxième page pour trois lignes
     de pied, ce qui fait négligé sur une facture. */
  .fac-titre-ligne{margin:24px 0 22px; padding-bottom:12px}
  .fac-feuille h1{font-size:31px}
  .fac-parties{margin-bottom:24px; gap:20px}
  .fac-bloc{padding:13px 15px}
  .fac-bloc p{line-height:1.65}
  .fac-table td{padding:10px 0}
  .fac-table td.fac-rang{padding-top:12px}
  .fac-bas{margin-top:20px}
  .fac-pied{margin-top:15px; padding-top:10px; line-height:1.62}
}
`
