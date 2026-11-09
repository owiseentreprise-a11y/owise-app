/**
 * La feuille du document Owise — facture ET devis.
 *
 * La maquette validée par l'exploitant le 2026-10-16. Les classes sont
 * préfixées « fac- » : cette page vit sous la mise en page d'administration,
 * dont les styles emploient des noms génériques (.bloc, .ligne, .total).
 *
 * Extraite de la page facture le 2026-11-02, sans en changer une regle, pour
 * que le devis la porte aussi. Un document a une seule definition : si cette
 * feuille vit a deux endroits, les deux divergent, et le client recoit deux
 * papiers qui ne se ressemblent plus.
 */
export const CSS_DOCUMENT = `
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
/* La colonne de gauche qui porte la date (facture) ou l'heure (devis).
   Elle vivait dans la feuille du DEVIS seulement : la facture n'avait donc
   aucune date a l'ecran, alors que son PDF en affichait une. Trois documents
   de la meme entreprise ne se ressemblaient pas — signale par l'exploitant le
   2026-11-09. Une seule regle, ici, pour les deux. */
.fac-table td.fac-date{
  /* min-width autant que width : en mise en page automatique, un
     tableau a 100 % reprend la largeur demandee par une colonne des que
     les autres en reclament. La colonne faisait 72 px sur le devis et
     63 px sur la facture, pour un contenu de meme longueur. */
  width:72px; min-width:72px; font-family:var(--font-jetbrains),'JetBrains Mono',monospace;
  font-size:12.5px; color:var(--encre); padding-top:15px; white-space:nowrap;
}
/* Meme raison que la colonne des dates : sans min-width, le tableau reprend
   cette largeur des que les autres colonnes en reclament, et le numero de
   ligne vient toucher la date. */
.fac-table td.fac-rang{width:28px; min-width:28px; padding-right:10px; color:var(--or); font-family:var(--font-jetbrains),'JetBrains Mono',monospace; font-size:11.5px; padding-top:16px}
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

/* Le pied des mentions legales. La facture l'ecrivait en 10,5 px et le
   devis le redefinissait en 8,5 px dans sa propre feuille : deux documents
   de la meme entreprise, imprimes le meme jour, avec deux tailles de
   caractere. Une seule regle, ici, a 9,5 px — lisible de pres sur la
   facture, assez compact pour les quatre mentions du devis. */
.fac-pied{margin-top:38px; padding-top:18px; border-top:1px solid var(--or-trait); font-size:9.5px; line-height:1.72; color:var(--encre-3)}
.fac-pied p{margin:0 0 4px}
.fac-pied p:last-child{margin-bottom:0}
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
  /* La regle d'ecran de cette colonne est plus specifique que
     « .fac-table td » ci-dessus : sans cette ligne, elle garderait son
     espacement d'ecran sur le papier. Meme raison que fac-rang. */
  .fac-table td.fac-date{padding-top:10px}
  .fac-bas{margin-top:20px}
  .fac-pied{margin-top:15px; padding-top:10px; line-height:1.62}
}
`
