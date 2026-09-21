'use client'

import { useState, useTransition } from 'react'
import { updatePrixGrille } from './actions'

type Zone = { id: string; nom: string; code: string; type: string }
type Grille = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }

function PrixCell({
  depart, arrivee, prix, coefPremium, coefVan, pecBerline, kmBerline, miroir,
}: {
  depart: string; arrivee: string; prix: number; coefPremium: number; coefVan: number
  pecBerline: number; kmBerline: number
  /** Case symétrique : lecture seule, la saisie se fait dans l'autre sens. */
  miroir?: boolean
}) {
  const [val, setVal] = useState(String(prix))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const save = () => {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) { setVal(String(prix)); setEditing(false); return }
    setSaving(true)
    setErreur(null)
    startTransition(async () => {
      const res = await updatePrixGrille(depart, arrivee, n)
      setSaving(false)
      setEditing(false)
      // Sans cette remontée, un échec d'enregistrement passait inaperçu.
      if (res?.error) { setErreur(res.error); setVal(String(prix)) }
    })
  }

  if (depart === arrivee) {
    return (
      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
        —
      </td>
    )
  }

  const berline = parseFloat(val) || 0

  // Une case à 0 ne veut pas dire « gratuit » : elle veut dire qu'aucun forfait
  // n'est défini pour cette paire, et que le calcul bascule au kilomètre
  // (calculerPrix ignore une valeur nulle et rend null). Afficher « 0 € » se
  // lisait comme un prix, d'où cet affichage explicite avec la formule réelle.
  const sansForfait = berline <= 0
  const libelleKm = `${pecBerline.toFixed(0)} € + ${kmBerline.toFixed(2).replace('.', ',')} €/km`

  // Case symétrique : non éditable. Les deux sens portent forcément le même
  // prix, une saisie des deux côtés ne pourrait que créer une divergence.
  if (miroir) {
    return (
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', background: 'rgba(0,0,0,.025)' }}>
        <div title="Se règle dans l'autre sens" style={{ padding: '4px 8px', cursor: 'not-allowed' }}>
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13,
            fontWeight: 500, color: 'var(--t3)',
          }}>
            {sansForfait ? 'au km' : `${berline.toFixed(0)} €`}
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
          fontSize: 9.5, color: 'var(--red)', marginBottom: 4,
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
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(String(prix)); setEditing(false) } }}
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
            fontWeight: sansForfait ? 500 : 600,
            color: saving ? 'var(--t3)' : sansForfait ? 'var(--t2)' : 'var(--gold)',
          }}>
            {sansForfait ? 'au km' : `${berline.toFixed(0)} €`}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
            {sansForfait
              ? libelleKm
              : `P: ${(berline * coefPremium).toFixed(0)}€ · V: ${(berline * coefVan).toFixed(0)}€`}
          </div>
        </button>
      )}
    </td>
  )
}

export default function TarifsMatrix({
  zones, grille, coefPremium, coefVan, pecBerline, kmBerline,
}: {
  zones: Zone[]; grille: Grille[]; coefPremium: number; coefVan: number
  /** Prise en charge et prix au kilomètre, affichés dans les cases sans forfait. */
  pecBerline: number; kmBerline: number
}) {
  const activeZones = zones.filter(z => z.code !== 'HORS')

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
      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 10, letterSpacing: '.08em' }}>
        CLIQUEZ SUR UN PRIX POUR LE MODIFIER — LES DEUX SENS SONT ENREGISTRÉS ENSEMBLE, LA CASE GRISÉE SUIT AUTOMATIQUEMENT — P: premium · V: van
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
                    key={arr.id}
                    depart={dep.id}
                    arrivee={arr.id}
                    prix={cell?.prix_berline ?? 0}
                    coefPremium={coefPremium}
                    coefVan={coefVan}
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
