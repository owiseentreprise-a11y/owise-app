'use client'

import { useState, useTransition } from 'react'
import { updatePrixGrille } from './actions'
import { formaterNombre } from '@/lib/montant'

type Zone = { id: string; nom: string; code: string; type: string }
type Grille = {
  zone_depart_id: string; zone_arrivee_id: string; prix_berline: number
  prix_berline_premium?: number | null
  prix_van?: number | null
  prix_grand_van?: number | null
}

/* Les quatre véhicules de la matrice, dans l'ordre de la gamme.
   `colonne` nomme la case de la grille que ce véhicule écrit ; la berline
   écrit `prix_berline`, qui reste le prix de référence du trajet. */
const VEHICULES = [
  { cle: 'berline',         nom: 'Berline',            colonne: 'prix_berline' },
  { cle: 'berline_premium', nom: 'Berline Premium',    colonne: 'prix_berline_premium' },
  { cle: 'van',             nom: 'Van 7 places',       colonne: 'prix_van' },
  { cle: 'grand_van',       nom: 'Grand Van 8 places', colonne: 'prix_grand_van' },
] as const
type CleVehicule = typeof VEHICULES[number]['cle']

function PrixCell({
  depart, arrivee, prix, prixFixe, vehicule, coefPremium, coefVan, supplementGrandVan,
  pecBerline, kmBerline, miroir,
}: {
  depart: string; arrivee: string
  /** Le prix berline du trajet : la référence dont tout le reste découle. */
  prix: number
  /** Le prix fixé pour CE véhicule, s'il y en a un. `null` = calculé. */
  prixFixe: number | null
  vehicule: CleVehicule
  coefPremium: number; coefVan: number; supplementGrandVan: number
  pecBerline: number; kmBerline: number
  /** Case symétrique : lecture seule, la saisie se fait dans l'autre sens. */
  miroir?: boolean
}) {
  /* Ce que le calcul donnerait pour ce véhicule, sans prix fixé. C'est la
     même formule que `calcPrix.ts` — affichée ici pour que l'exploitant voie
     ce qu'il remplace avant de le remplacer. */
  const calcule =
    vehicule === 'berline'         ? prix
    : vehicule === 'berline_premium' ? prix * coefPremium
    : vehicule === 'van'             ? prix * coefVan
    :                                  prix * coefVan + supplementGrandVan

  const estBerline = vehicule === 'berline'
  /* La valeur modifiable : le prix berline, ou le prix fixé du véhicule.
     Une case non fixée s'ouvre VIDE, pas pré-remplie avec le calcul — sans
     quoi un simple clic suivi d'Entrée figerait le prix calculé sans que
     l'exploitant ait voulu le figer. */
  const valeurInitiale = estBerline ? String(prix) : (prixFixe != null ? String(prixFixe) : '')
  const [val, setVal] = useState(valeurInitiale)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const save = () => {
    /* Une case vidée est une intention, pas une erreur de frappe : pour un
       véhicule autre que la berline, elle veut dire « reviens au calcul ».
       On envoie 0, et l'action écrit `null` en base. */
    const brut = val.trim()
    const n = brut === '' ? 0 : parseFloat(brut)
    if (isNaN(n) || n < 0) { setVal(valeurInitiale); setEditing(false); return }
    setSaving(true)
    setErreur(null)
    startTransition(async () => {
      const res = await updatePrixGrille(depart, arrivee, n, vehicule)
      setSaving(false)
      setEditing(false)
      // Sans cette remontée, un échec d'enregistrement passait inaperçu.
      if (res?.error) { setErreur(res.error); setVal(valeurInitiale) }
    })
  }

  if (depart === arrivee) {
    return (
      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
        —
      </td>
    )
  }

  // Une case à 0 ne veut pas dire « gratuit » : elle veut dire qu'aucun forfait
  // n'est défini pour cette paire, et que le calcul bascule au kilomètre
  // (calculerPrix ignore une valeur nulle et rend null). Afficher « 0 € » se
  // lisait comme un prix, d'où cet affichage explicite avec la formule réelle.
  //
  // C'est le prix BERLINE qui décide : sans forfait de référence, aucun
  // véhicule n'a de forfait sur ce trajet, et fixer un prix de van sur une
  // ligne qui n'existe pas n'aurait nulle part où s'écrire.
  const sansForfait = prix <= 0

  /* Ce qu'on montre dans la case, et pourquoi.
     · berline            → son prix, point ;
     · prix fixé          → ce prix, en or, « prix fixé » dessous ;
     · rien de fixé       → le prix calculé, en gris, avec sa formule.
     Montrer le calculé en gris plutôt qu'un tiret, c'est ce qui permet à
     l'exploitant de voir ce qu'il va remplacer avant de le remplacer. */
  const estFixe = !estBerline && prixFixe != null && prixFixe > 0
  const montre = estBerline ? prix : (estFixe ? (prixFixe as number) : calcule)
  const sousLigne = estBerline
    ? `P: ${(prix * coefPremium).toFixed(0)}€ · V: ${(prix * coefVan).toFixed(0)}€`
    : estFixe
      ? 'prix fixé'
      : vehicule === 'grand_van'
        ? `calculé · van + ${supplementGrandVan.toFixed(0)} €`
        : `calculé · ×${formaterNombre(vehicule === 'van' ? coefVan : coefPremium)}`
  // La virgule decimale venait d'un .replace('.', ',') ecrit ici : une
  // deuxieme ecriture du format francais, a cote de celle de montant.ts.
  // Le prix de prise en charge reste sans decimale, c'est voulu.
  const libelleKm = `${pecBerline.toFixed(0)} € + ${formaterNombre(kmBerline)} €/km`

  // Case symétrique : non éditable. Les deux sens portent forcément le même
  // prix, une saisie des deux côtés ne pourrait que créer une divergence.
  if (miroir) {
    return (
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', background: 'rgba(201,168,76,.12)' }}>
        <div title="Se règle dans l'autre sens" style={{ padding: '4px 8px', cursor: 'not-allowed' }}>
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13,
            fontWeight: 500, color: 'var(--t3)',
          }}>
            {sansForfait ? 'au km' : `${montre.toFixed(0)} €`}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, opacity: .6 }}>
            {sansForfait ? libelleKm : '↔ symétrique'}
          </div>
        </div>
      </td>
    )
  }

  return (
    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
      {erreur && (
        <div style={{
          fontSize: 9.5, color: 'var(--red-txt)', marginBottom: 4,
          maxWidth: 150, lineHeight: 1.3,
        }}>
          {erreur}
        </div>
      )}
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            autoFocus
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={save}
            placeholder={estBerline ? '' : calcule.toFixed(0)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(valeurInitiale); setEditing(false) } }}
            style={{
              width: 70, padding: '4px 8px',
              background: 'var(--elevated)', border: '1px solid var(--gold)',
              borderRadius: 6, color: 'var(--t1)', fontSize: 13,
              fontFamily: 'var(--font-jetbrains), monospace',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>€</span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 6,
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13,
            fontWeight: sansForfait || (!estBerline && !estFixe) ? 500 : 600,
            /* Un prix calculé s'affiche en gris, un prix fixé en or : la
               couleur dit d'un coup d'œil ce qui a été décidé à la main. */
            color: saving ? 'var(--t3)'
              : sansForfait ? 'var(--t2)'
              : (!estBerline && !estFixe) ? 'var(--t2)'
              : 'var(--gold)',
          }}>
            {sansForfait ? 'au km' : `${montre.toFixed(0)} €`}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
            {sansForfait ? libelleKm : sousLigne}
          </div>
        </button>
      )}
    </td>
  )
}

export default function TarifsMatrix({
  zones, grille, coefPremium, coefVan, pecBerline, kmBerline, supplementGrandVan = 20,
}: {
  zones: Zone[]; grille: Grille[]; coefPremium: number; coefVan: number
  /** Prise en charge et prix au kilomètre, affichés dans les cases sans forfait. */
  pecBerline: number; kmBerline: number
  /** Supplément du Grand Van sur le prix du van, pour afficher son calcul. */
  supplementGrandVan?: number
}) {
  const activeZones = zones.filter(z => z.code !== 'HORS')
  /* Un seul tableau, quatre véhicules — plutôt que quatre tableaux empilés.
     La matrice fait déjà 14 colonnes et défile dans les deux sens ; en
     afficher quatre l'une sous l'autre rendrait la page illisible, et
     surtout on perdrait la comparaison : ici, changer de véhicule garde la
     même case sous les yeux. */
  const [vehicule, setVehicule] = useState<CleVehicule>('berline')

  const getCell = (dep: string, arr: string) =>
    grille.find(g => g.zone_depart_id === dep && g.zone_arrivee_id === arr)

  // En-tête et première colonne figés.
  //
  // Sans ça, la matrice est inutilisable dès qu'elle dépasse la largeur de
  // l'écran : en faisant défiler vers la droite on perd le nom de la ligne, et
  // vers le bas le nom de la colonne — on modifie donc un prix sans savoir quel
  // trajet on modifie. Signalé le 2026-09-21.
  //
  // Le conteneur doit avoir sa PROPRE hauteur et son propre défilement : un
  // `position: sticky; top` se cale sur l'ancêtre qui défile, et `overflow-x`
  // seul en faisait déjà un — l'en-tête n'aurait donc jamais collé.
  //
  // Les bordures sont posées en `box-shadow: inset`, pas en `border` : avec
  // `border-collapse: collapse`, les bordures d'une cellule figée disparaissent
  // pendant le défilement.
  const FOND = 'var(--surface)'
  const entete: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2, background: FOND,
    boxShadow: 'inset 0 -1px 0 rgba(201,168,76,.18)',
  }
  const colonneFigee: React.CSSProperties = {
    position: 'sticky', left: 0, zIndex: 1, background: FOND,
    boxShadow: 'inset -1px 0 0 var(--gb)',
  }

  return (
    <>
      {/* Le choix du véhicule. Il change ce que les cases montrent ET ce
          qu'une saisie écrit : en « Van », taper 110 fixe le van de ce
          trajet à 110 €, sans toucher aux 126 autres trajets. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {VEHICULES.map(v => {
          const actif = v.cle === vehicule
          const combien = v.cle === 'berline'
            ? grille.filter(g => Number(g.prix_berline) > 0).length
            : grille.filter(g => (g[v.colonne as 'prix_van'] ?? 0) > 0).length
          return (
            <button
              key={v.cle}
              onClick={() => setVehicule(v.cle)}
              style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                background: actif ? 'var(--gold-muted)' : 'transparent',
                border: `1px solid ${actif ? 'var(--gold)' : 'var(--gb)'}`,
                color: actif ? 'var(--gold)' : 'var(--t2)',
                fontSize: 12, fontWeight: actif ? 600 : 500,
                transition: 'color .15s, border-color .15s',
              }}
            >
              {v.nom}
              <span style={{ fontSize: 10, opacity: .7, marginLeft: 7, fontFamily: 'var(--font-jetbrains), monospace' }}>
                {v.cle === 'berline' ? `${combien} forfaits` : combien > 0 ? `${combien} fixés` : 'calculé'}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 10, letterSpacing: '.08em' }}>
        {vehicule === 'berline' ? (
          <>CLIQUEZ SUR UN PRIX POUR LE MODIFIER — LES DEUX SENS SONT ENREGISTRÉS ENSEMBLE, LA CASE GRISÉE SUIT AUTOMATIQUEMENT — P: premium · V: van</>
        ) : (
          <>UN PRIX EN GRIS EST <b>CALCULÉ</b> À PARTIR DE LA BERLINE — CLIQUEZ POUR LE FIXER, IL PASSE EN OR. VIDEZ LA CASE POUR REVENIR AU CALCUL.
          {vehicule === 'grand_van' && <><br />GRAND VAN : UN PRIX FIXÉ EST ANNONCÉ AU CLIENT COMME FERME, MAIS LA COURSE PASSE TOUJOURS PAR VOTRE VALIDATION DE DISPONIBILITÉ.</>}</>
        )}
        <br />
        « AU KM » = AUCUN FORFAIT POUR CE TRAJET : IL EST FACTURÉ À LA DISTANCE. METTRE 0 DANS UNE CASE REVIENT À LA REPASSER AU KILOMÈTRE.
        <br />
        LE TABLEAU DÉFILE DANS LES DEUX SENS — LA LIGNE DE GAUCHE ET L&apos;EN-TÊTE DU HAUT RESTENT VISIBLES.
      </div>
    {/* La hauteur est volontairement plafonnee sous celle du tableau : c'est
        ce plafond qui fait du conteneur le vrai element defilant, et donc ce
        qui permet a l'en-tete de coller. Sans plafond, l'en-tete repartirait
        avec la page. Pas d'`overscroll-behavior: contain` : on laisse la page
        continuer a defiler quand on arrive en bas du tableau. */}
    <div style={{ overflow: 'auto', maxHeight: 'min(72dvh, 820px)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{
              ...entete, ...colonneFigee, zIndex: 3,
              boxShadow: 'inset 0 -1px 0 rgba(201,168,76,.18), inset -1px 0 0 var(--gb)',
              padding: '8px 14px', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--t3)', fontWeight: 500, textAlign: 'left',
            }}>
              DÉPART → ARRIVÉE
            </th>
            {activeZones.map(z => (
              <th key={z.id} style={{
                ...entete,
                padding: '8px 12px', fontSize: 10, color: 'var(--t2)', fontWeight: 500,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}>
                <div>{z.nom}</div>
                <div style={{ fontSize: 8, color: 'var(--t3)', letterSpacing: '.08em' }}>{z.code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeZones.map((dep, i) => (
            <tr key={dep.id} style={{ borderBottom: '1px solid rgba(201,168,76,.04)' }}>
              <td style={{
                ...colonneFigee,
                padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--t1)',
                whiteSpace: 'nowrap',
              }}>
                <div>{dep.nom}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>{dep.code}</div>
              </td>
              {activeZones.map((arr, j) => {
                // Une paire n'a qu'un prix : on n'en rend éditable qu'un côté
                // (triangle supérieur), l'autre affiche la même valeur en grisé.
                const miroir = j < i
                const cell = getCell(dep.id, arr.id) ?? getCell(arr.id, dep.id)
                return (
                  <PrixCell
                    key={`${arr.id}-${vehicule}`}
                    depart={dep.id}
                    arrivee={arr.id}
                    prix={cell?.prix_berline ?? 0}
                    prixFixe={
                      vehicule === 'berline' ? null
                      : vehicule === 'berline_premium' ? (cell?.prix_berline_premium ?? null)
                      : vehicule === 'van' ? (cell?.prix_van ?? null)
                      : (cell?.prix_grand_van ?? null)
                    }
                    vehicule={vehicule}
                    /* `key` porte le véhicule : sans ça React réutilise la
                       cellule d'un véhicule à l'autre, et son `useState`
                       initial — donc la valeur saisie — ne se réinitialise
                       pas. On afficherait le prix du van dans l'onglet
                       premium. */
                    coefPremium={coefPremium}
                    coefVan={coefVan}
                    supplementGrandVan={supplementGrandVan}
                    pecBerline={pecBerline}
                    kmBerline={kmBerline}
                    miroir={miroir}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}
