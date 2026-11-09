/**
 * Le document « facture », tel qu'on le remet au client.
 *
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Une facture Owise existait sous QUATRE formes, et les quatre étaient des
 * dessins différents :
 *
 *   1. /admin/facturation/[id]/document — la maquette validée le 2026-10-16 ;
 *   2. le PDF joint à l'e-mail — dessiné à la main avec pdf-lib ;
 *   3. /espace-client/factures/[id] — une troisième mise en page, avec sa
 *      PROPRE lecture de la table `parametres` ;
 *   4. le corps de l'e-mail lui-même — un résumé, légitimement différent.
 *
 * L'exploitant, le 2026-11-09 : « à chaque fois la mise en forme de la facture
 * change, on voit pas les mêmes informations sur l'entreprise ». Il regardait
 * la forme 1 ; son client recevait la 2 et consultait la 3.
 *
 * Les formes 1 et 3 sont désormais CE composant. La forme 2 est
 * `facture-pdf.ts`, qui reprend la même feuille mesure par mesure — un PDF ne
 * peut pas rendre du HTML, mais il peut rendre les mêmes dimensions.
 *
 * Il ne décide RIEN : tout vient de `chargerDocumentFacture()`. Aucun libellé,
 * aucun montant, aucune mention légale n'est écrit ici.
 *
 * SÉCURITÉ : ce composant ne vérifie aucun droit d'accès. L'appelant doit
 * s'être assuré que la personne a le droit de voir CETTE facture — la page de
 * l'espace client le fait avec le client Supabase de l'utilisateur, avant
 * d'appeler `chargerDocumentFacture()`, qui lit, lui, avec la clé de service.
 */
import { formaterMontant, type DocumentFacture } from '@/lib/facture-document'

export default function FeuilleFacture({ doc }: { doc: DocumentFacture }) {
  const n = (i: number) => String(i + 1).padStart(2, '0')

  /* Vrai quand TOUTES les lignes sont saisies à la main : il n'y a alors aucune
     date de course à montrer, et « Trajet » devient « Désignation ». Déclaré
     une fois, lu par l'en-tête et par les lignes — pour qu'ils ne puissent pas
     diverger et produire une colonne d'en-tête sans cellule en face. */
  const toutSaisi = doc.lignes.length > 0 && doc.lignes.every(l => l.libelle)

  return (
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
            {/* La DATE manquait a l'ecran alors que le PDF l'affichait, et que
               le devis affiche l'heure. Sur une facture qui regroupe plusieurs
               courses, le client ne pouvait pas savoir quelle ligne correspond
               a quel jour. La colonne s'efface sur une facture saisie a la
               main, ou aucune ligne ne porte de date. */}
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
            /* Ce texte part sur un document remis au client. Il ne doit
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
          {/* Jamais d'IBAN sur une facture acquittée : le client pourrait payer
             une seconde fois. La décision est prise dans facture-document.ts,
             qui met `banque` à null — elle n'est pas reprise ici. */}
          {doc.banque?.iban && <span className="fac-mono">{doc.banque.iban}</span>}
          {doc.banque?.bic && <span className="fac-mono">BIC {doc.banque.bic}</span>}
        </div>

        <div>
          {doc.recap.map((r, i) => (
            <div className="fac-ligne" key={i}><span>{r.libelle}</span><span>{formaterMontant(r.montant)}</span></div>
          ))}
          <div className="fac-ligne"><span>TVA</span><span>{doc.mentionTva}</span></div>
          <div className="fac-total">
            <span>{doc.payee ? 'Montant réglé' : 'Net à payer'}</span>
            <b>{formaterMontant(doc.montantTtc)}</b>
          </div>
        </div>
      </div>

      {/* Les mentions viennent de `chargerDocumentFacture()`, comme tout le
          reste du document. Elles étaient écrites en toutes lettres dans la
          page d'administration, et nulle part ailleurs : le PDF joint à
          l'e-mail n'en portait donc aucune, et la page de l'espace client non
          plus. Le client gardait une facture sans son régime de TVA ni les
          pénalités de retard, que la loi impose. Trouvé le 2026-11-09. */}
      <footer className="fac-pied">
        {doc.mentionsLegales.map((m, i) => (
          <p key={i}>{m.fort && <b>{m.fort}</b>}{m.texte}</p>
        ))}
      </footer>

    </div>
  )
}
