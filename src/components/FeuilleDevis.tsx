/**
 * Le document « devis », tel qu'on le remet au client.
 *
 * POURQUOI UN COMPOSANT PARTAGÉ
 *
 * Le même document doit s'afficher à deux endroits : la page
 * /admin/devis-clients/[id]/document, que l’exploitant imprime, et la page
 * publique /devis/[jeton], où le client lit son devis et l’accepte.
 *
 * Deux copies de ce balisage auraient divergé — une facture a existé en
 * QUATRE dessins sur ce projet, et il a fallu une journée pour les
 * réunir. On ne recommence pas.
 *
 * Il ne décide rien : tout vient de `chargerDevis()` et des fonctions de
 * `devis-client.ts`, partagées avec le PDF.
 */
import { formaterMontant } from '@/lib/montant'
import {
  basDePage, dateCourte, dateLongue, formaterTelephone, jourEmission, lignesReglement,
  phraseAccord,
  type DevisClient, type Prestataire,
} from '@/lib/devis-client'

export default function FeuilleDevis({
  devis,
  prestataire,
}: {
  devis: DevisClient
  prestataire: Prestataire
}) {
  const n = (i: number) => String(i + 1).padStart(2, '0')
  const jour = dateLongue(devis.date_prestation)

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
            {/* La forme juridique, l'adresse de l'entreprise, le SIRET et le
               code APE. `chargerPrestataire()` les construisait deja, et
               AUCUNE page ne les affichait : le devis ne portait donc pas la
               meme identite d'entreprise que la facture qui le suit. C'est
               exactement ce que l'exploitant a signale le 2026-11-09 — « on
               ne voit pas les memes informations sur l'entreprise ».
               Un devis doit porter l'identite complete du prestataire, et il
               l'ecrit maintenant au meme endroit et dans le meme style que
               la facture. */}
            <span className="fac-legal">
              {prestataire.legal.map((l, i) => <span key={i}>{l}<br /></span>)}
            </span>
          </p>
        </div>
        <div className="fac-bloc">
          <div className="fac-etiquette">Client</div>
          <p>
            <strong>{devis.client_societe || devis.client_nom}</strong>
            {devis.client_societe && <>À l&apos;attention de {devis.client_nom}<br /></>}
            {devis.client_adresse && devis.client_adresse.split(',').map((m, i) => <span key={i}>{m.trim()}<br /></span>)}
            {/* Le meme formatage que la facture : « 0625322189 » y devenait
               « 06 25 32 21 89 », et restait colle sur le devis. */}
            {devis.client_tel && <>{formaterTelephone(devis.client_tel)}<br /></>}
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
              <td className="fac-date">{l.heure}</td>
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
          {/* Lu dans `lignesReglement()`, jamais retapé : ce texte existait
              en double — ici et dans la constante que lisait le PDF. */}
          {lignesReglement(devis).map((l, i) => (
            <span key={i}>{l}<br /></span>
          ))}
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

      {/* LA PHRASE D’ACCORD vient de `phraseAccord()`, comme pour le PDF.

          Elle était tapée en dur ici, et elle demandait de renvoyer le
          document « daté et signé » — une phrase qui envoie le client
          chercher une imprimante alors qu’un bouton attend juste au-dessus
          de son écran. Et le cadre de signature n’a plus de sens quand la
          confirmation se fait en ligne : il disparaît dans ce cas. */}
      <div className="dv-signature">
        <p>{phraseAccord(devis)}</p>
        {!devis.carte_requise && (
          <div className="dv-cadre">Date, signature et mention « bon pour accord »</div>
        )}
      </div>

      {/* Tout ce qui doit figurer sans prendre la place : annulation, clause
          d'attente, regime de TVA, penalites de retard. L'identite de
          l'entreprise n'est pas ici : elle est dans le bloc « Prestataire »,
          au meme endroit que sur la facture. La
          liste et son ordre viennent de `basDePage()`, partagee avec le PDF
          — ecrire ce pied deux fois le ferait diverger. */}
      <footer className="fac-pied">
        {basDePage(devis).map((m, i) => <p key={i}>{m}</p>)}
      </footer>

    </div>
  )
}
