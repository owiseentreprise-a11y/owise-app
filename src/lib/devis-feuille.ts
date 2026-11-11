/**
 * Ce qu'un devis a et qu'une facture n'a pas : la colonne des heures a
 * rejoint la feuille partagée, restent le cadre de signature et les règles
 * d'impression propres à un devis long.
 *
 * Sorti de la page du document le 2026-11-11, parce que la page PUBLIQUE
 * /devis/[jeton] en a besoin elle aussi. Deux copies auraient divergé.
 */
export const CSS_DEVIS = `
/* Le pied de page a rejoint la feuille PARTAGEE : sa taille y est unique pour
   le devis et pour la facture. Deux definitions, c'etaient deux tailles de
   caractere sur deux documents de la meme entreprise. */

/* La colonne des heures a rejoint la feuille PARTAGEE sous le nom .fac-date :
   la facture en avait besoin aussi, et deux copies de la meme regle, c'est
   deux presentations qui finissent par diverger. */
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
