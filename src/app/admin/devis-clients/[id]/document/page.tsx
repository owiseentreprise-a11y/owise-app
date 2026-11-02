/**
 * Le devis tel qu'on le remet au client — prêt à imprimer ou à enregistrer en
 * PDF depuis le navigateur.
 *
 * Il ne redessine rien : il porte `CSS_DOCUMENT`, la feuille extraite de la
 * facture et partagée avec elle. Un devis et la facture qui le suit doivent se
 * ressembler ; s'ils portaient deux feuilles, elles divergeraient.
 *
 * Seules les parties qui n'existent pas sur une facture sont ajoutées ici :
 * la colonne des heures, l'encadré d'attente et le cadre de signature.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formaterMontant } from '@/lib/montant'
import { CSS_DOCUMENT } from '@/lib/document-feuille'
import {
  basDePage, chargerDevis, chargerPrestataire, dateCourte, dateLongue, jourEmission,
} from '@/lib/devis-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const devis = await chargerDevis((await params).id)
  return {
    title: devis ? `Devis ${devis.numero} — ${devis.client_nom}` : 'Devis',
    robots: { index: false },
  }
}

export default async function DocumentDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [devis, prestataire] = await Promise.all([chargerDevis(id), chargerPrestataire()])
  if (!devis) notFound()

  const n = (i: number) => String(i + 1).padStart(2, '0')
  const jour = dateLongue(devis.date_prestation)

  return (
    <>
      <style>{CSS_DOCUMENT}</style>
      <style>{CSS_DEVIS}</style>

      <div className="fac-barre">
        <Link href={`/admin/devis-clients/${id}`} className="fac-retour">← Retour au devis</Link>
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
              <div className="fac-metier">{prestataire.metier}</div>
            </div>
          </div>
          <div className="fac-coord">
            <b>{prestataire.nom}</b><br />
            {prestataire.telephone}<br />
            {prestataire.email}<br />
            {prestataire.siret && <span className="fac-mono">SIRET {prestataire.siret}</span>}
          </div>
        </div>

        <div className="fac-titre-ligne">
          <div>
            <h1>Devis</h1>
            <div className="fac-numero">{devis.numero}</div>
          </div>
          <div className="fac-reperes">
            {devis.date_prestation && (
              <>Prestations prévues le &nbsp; <b>{dateCourte(devis.date_prestation)}</b><br /></>
            )}
            Devis émis le &nbsp; <b>{dateCourte(jourEmission(devis))}</b><br />
            {devis.date_validite && (
              <>Valable jusqu&apos;au &nbsp; <b>{dateCourte(devis.date_validite)}</b></>
            )}
          </div>
        </div>

        <div className="fac-parties">
          <div className="fac-bloc">
            <div className="fac-etiquette">Prestataire</div>
            <p>
              <strong>{prestataire.nom}</strong>
              {prestataire.metier}<br />
              {prestataire.telephone} · {prestataire.email}
            </p>
          </div>
          <div className="fac-bloc">
            <div className="fac-etiquette">Client</div>
            <p>
              <strong>{devis.client_societe || devis.client_nom}</strong>
              {devis.client_societe && <>À l&apos;attention de {devis.client_nom}<br /></>}
              {devis.client_adresse && devis.client_adresse.split(',').map((m, i) => <span key={i}>{m.trim()}<br /></span>)}
              {devis.client_tel && <>{devis.client_tel}<br /></>}
              {devis.client_email}
            </p>
          </div>
        </div>

        <table className="fac-table">
          <caption>{jour ? `Prestations du ${jour}` : 'Prestations'}</caption>
          <thead>
            <tr>
              <th></th>
              <th>Heure</th>
              <th>Trajet</th>
              <th className="fac-chiffre">Montant</th>
            </tr>
          </thead>
          <tbody>
            {devis.lignes.map((l, i) => (
              <tr key={i}>
                <td className="fac-rang">{n(i)}</td>
                <td className="dv-heure">{l.heure}</td>
                <td>
                  <div className="fac-trajet">{l.depart} → {l.arrivee}</div>
                  {(l.vehicule || l.passagers || l.observations) && (
                    <div className="fac-detail">
                      {[l.vehicule,
                        l.passagers ? `${l.passagers} passager${l.passagers > 1 ? 's' : ''}` : null,
                        l.observations].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </td>
                <td className="fac-chiffre">{formaterMontant(Number(l.prix))}</td>
              </tr>
            ))}
            {devis.lignes.length === 0 && (
              <tr><td colSpan={4} className="fac-vide">Aucune prestation sur ce devis.</td></tr>
            )}
          </tbody>
        </table>

        <div className="fac-bas">
          <div className="fac-reglement">
            <div className="fac-etiquette">Règlement</div>
            Par virement bancaire, à réception de la facture.<br />
            Les coordonnées bancaires figureront sur celle-ci.
          </div>

          <div>
            <div className="fac-ligne">
              <span>{devis.lignes.length} transfert{devis.lignes.length > 1 ? 's' : ''}</span>
              <span>{formaterMontant(Number(devis.total_ht))}</span>
            </div>
            <div className="fac-ligne"><span>TVA</span><span>non applicable</span></div>
            <div className="fac-total">
              <span>Net à payer</span>
              <b>{formaterMontant(Number(devis.total_ht))}</b>
            </div>
          </div>
        </div>

        <div className="dv-signature">
          <p>
            {devis.date_validite && <>Devis valable jusqu&apos;au <b>{dateCourte(devis.date_validite)}</b>.<br /></>}
            Pour accord, retournez ce document daté et signé, avec la mention
            « bon pour accord », ou répondez par écrit à l&apos;adresse ci-dessus.
          </p>
          <div className="dv-cadre">Date, signature et mention « bon pour accord »</div>
        </div>

        {/* Tout ce qui doit figurer sans prendre la place : clause d'attente,
            identite de l'entreprise, regime de TVA, penalites de retard. La
            liste et son ordre viennent de `basDePage()`, partagee avec le PDF
            — ecrire ce pied deux fois le ferait diverger. */}
        <footer className="fac-pied">
          {basDePage(devis, prestataire).map((m, i) => <p key={i}>{m}</p>)}
        </footer>

      </div>
    </>
  )
}

/* Ce qu'une facture n'a pas : l'heure de chaque prise en charge, la clause
 * d'attente et le cadre de signature. Les classes gardent le préfixe « dv- »
 * pour qu'on voie d'un coup d'œil ce qui appartient au devis seul. */
const CSS_DEVIS = `
/* Le pied porte quatre mentions au lieu de deux : clause d'attente,
   identite de l'entreprise, TVA, penalites. A 10,5 px — la taille heritee
   de la facture — il reprenait le tiers de la page qu'on venait de lui
   retirer. Il descend a 8,5 px : lisible de pres, invisible de loin. */
.fac-pied{font-size:8.5px; line-height:1.7}
.fac-pied p{margin:0 0 4px}
.fac-pied p:last-child{margin-bottom:0}

.fac-table td.dv-heure{
  width:72px; font-family:var(--font-jetbrains),'JetBrains Mono',monospace;
  font-size:12.5px; color:var(--encre); padding-top:15px; white-space:nowrap;
}
.dv-signature{
  margin-top:34px; padding-top:18px; border-top:1px solid var(--or-trait);
  display:grid; grid-template-columns:1fr 240px; gap:30px; align-items:start;
}
.dv-signature p{margin:0; font-size:11.5px; line-height:1.8; color:var(--encre-2)}
.dv-signature b{color:var(--encre); font-weight:500}
.dv-cadre{
  border:1px dashed rgba(9,9,26,.22); border-radius:8px; height:84px;
  padding:8px 10px; font-size:10px; color:var(--encre-3);
}
@media (max-width:640px){
  .dv-signature{grid-template-columns:1fr}
}
@media print{
  .dv-signature{margin-top:16px; padding-top:12px}
  .dv-cadre{height:62px}
  .fac-table td.dv-heure{padding-top:10px}

  /* Un devis de huit prestations dépasse l'A4 : mesuré le 2026-11-02, la
     feuille faisait 1 509 px pour 1 123 px de page utile. La coupure tombait
     juste après l'encadré d'attente et laissait le TOTAL seul en page 2 —
     c'est le chiffre que le client cherche en premier.

     Plutôt que de comprimer la typographie jusqu'à l'illisible pour gagner
     390 px, on interdit à chaque bloc de se couper en deux. Le navigateur
     repousse alors le bloc entier sur la page suivante. Un devis court tient
     toujours sur une page ; un devis long se coupe à un endroit choisi. */
  .fac-table tr,
  .fac-bas,
  .dv-signature,
  .fac-pied        { break-inside: avoid; page-break-inside: avoid }

  /* Le total, la signature et les mentions forment un tout : les séparer
     donnerait une page avec un montant sans son cadre d'accord. */
  .fac-bas         { break-after: avoid; page-break-after: avoid }
  .dv-signature    { break-after: avoid; page-break-after: avoid }
}
`
