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
import { CSS_DOCUMENT as CSS } from '@/lib/document-feuille'

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
  /* Vrai quand TOUTES les lignes sont saisies a la main : il n'y a alors
     aucune date de course a montrer, et la colonne « Trajet » devient
     « Designation ». Declare une fois, lu par l'en-tete et par les lignes. */
  if (!doc) {
    console.error('[facture/document] document vide pour', JSON.stringify(id))
    notFound()
  }

  const n = (i: number) => String(i + 1).padStart(2, '0')

  /* Vrai quand TOUTES les lignes sont saisies à la main : il n'y a alors aucune
     date de course à montrer, et « Trajet » devient « Désignation ». Déclaré
     une fois, lu par l'en-tête et par les lignes — pour qu'ils ne puissent pas
     diverger et produire une colonne d'en-tête sans cellule en face. */
  const toutSaisi = doc.lignes.length > 0 && doc.lignes.every(l => l.libelle)

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
              {/* La DATE manquait a l'ecran alors que le PDF l'affichait, et
                 que le devis affiche l'heure : trois documents de la meme
                 entreprise ne se ressemblaient pas. Signale par l'exploitant
                 le 2026-11-09. Sur une facture qui regroupe plusieurs courses,
                 le client ne pouvait pas savoir quelle ligne correspond a quel
                 jour. La colonne s'efface sur une facture saisie a la main,
                 ou aucune ligne ne porte de date. */}
              {!toutSaisi && <th>Date</th>}
              <th>{toutSaisi ? 'Désignation' : 'Trajet'}</th>
              <th className="fac-chiffre">Montant</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l, i) => (
              <tr key={i}>
                <td className="fac-rang">{n(i)}</td>
                {!toutSaisi && <td className="fac-date">{l.date}</td>}
                <td>
                  <div className="fac-trajet">{l.libelle ?? `${l.depart} → ${l.arrivee}`}</div>
                  {l.detail && <div className="fac-detail">{l.detail}</div>}
                </td>
                <td className="fac-chiffre">{formaterMontant(l.montantHt)}</td>
              </tr>
            ))}
            {doc.lignes.length === 0 && (
              /* Ce texte partait sur un document remis au client. Il ne doit
                 apparaître que si la facture est RÉELLEMENT vide — plus le cas
                 dès qu'un récapitulatif est saisi, qui fournit les lignes. */
              <tr><td colSpan={toutSaisi ? 3 : 4} className="fac-vide">Aucune prestation détaillée sur cette facture.</td></tr>
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
            {/* La meme ligne que sur le devis. Elle manquait : le cadre du
               total ne portait que « NET A PAYER », la ou le devis du meme
               jour portait le detail puis la TVA. Deux documents de la meme
               entreprise avec deux blocs de total differents. */}
            <div className="fac-ligne"><span>TVA</span><span>{doc.mentionTva}</span></div>
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

/* La feuille vit dans `@/lib/document-feuille` : le devis la partage. */
