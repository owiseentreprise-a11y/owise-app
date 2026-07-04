'use client'

import { useState, useTransition } from 'react'
import { updateParametresTarifs } from './actions'

const inp: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--t1)',
  width: '90px', outline: 'none', fontFamily: 'var(--font-jetbrains), monospace',
  textAlign: 'right',
}

function Badge({ actif, label }: { actif: boolean; label?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 20,
      background: actif ? 'rgba(61,184,122,.12)' : 'rgba(132,132,153,.1)',
      color: actif ? 'var(--green)' : 'var(--t3)',
    }}>
      {label ?? (actif ? 'Actif' : 'Inactif')}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', paddingTop: 20, marginTop: 20 }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, desc, name, value, unit = '€', isBoolean, isActive, onChange }: {
  label: string
  desc: string
  name: string
  value: string | number | boolean
  unit?: string
  isBoolean?: boolean
  isActive?: boolean
  onChange?: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 16px', borderRadius: 10,
      background: isActive === false ? 'rgba(132,132,153,.04)' : 'rgba(201,168,76,.03)',
      border: `1px solid ${isActive === false ? 'rgba(132,132,153,.1)' : 'rgba(201,168,76,.08)'}`,
      opacity: isActive === false ? 0.7 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      {isBoolean ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Badge actif={String(value) === 'true'} />
          <select
            name={name}
            defaultValue={String(value)}
            onChange={e => onChange?.(e.target.value)}
            style={{ ...inp, width: 'auto', padding: '8px 28px 8px 12px', cursor: 'pointer', appearance: 'auto', textAlign: 'left' }}
          >
            <option value="true">Activé</option>
            <option value="false">Désactivé</option>
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input
            name={name}
            type="number"
            step="0.01"
            min="0"
            defaultValue={String(value ?? 0)}
            onChange={e => onChange?.(e.target.value)}
            style={inp}
          />
          <span style={{ fontSize: 12, color: 'var(--t2)', minWidth: 16 }}>{unit}</span>
        </div>
      )}
    </div>
  )
}

export default function GlobalParamsForm({ p }: { p: any }) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Valeurs réactives pour les indicateurs d'état
  const [pecActif, setPecActif]     = useState(String(p?.tarif_pec_actif ?? false))
  const [fraisPec, setFraisPec]     = useState(Number(p?.tarif_frais_pec ?? 0))
  const [etape, setEtape]           = useState(Number(p?.supplement_etape ?? 10))
  const [nuit, setNuit]             = useState(Number(p?.supplement_nuit ?? 0))
  const [weekend, setWeekend]       = useState(Number(p?.supplement_weekend ?? 0))
  const [ferie, setFerie]           = useState(Number(p?.supplement_ferie ?? 0))
  const [coefB, setCoefB]           = useState(Number(p?.coef_berline ?? 1))
  const [coefBP, setCoefBP]         = useState(Number(p?.coef_berline_premium ?? 1.25))
  const [coefV, setCoefV]           = useState(Number(p?.coef_van ?? 1.5))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false); setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateParametresTarifs(fd)
      if (res?.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* Frais administratif optionnel */}
      <Section title="Frais de déplacement supplémentaire (optionnel)">
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8, padding: '8px 12px', background: 'rgba(132,132,153,.06)', borderRadius: 8 }}>
          ⚠ Ce frais est différent de la "Prise en charge" dans les tarifs véhicules ci-dessus. Il s'ajoute en plus si vous souhaitez facturer un surcoût fixe séparé pour chaque course.
        </div>
        <Row
          label="Activer un frais fixe additionnel"
          desc="Si activé, un montant fixe supplémentaire est ajouté à chaque course, en plus du prix calculé (km ou forfait)."
          name="tarif_pec_actif"
          value={pecActif}
          isBoolean
          onChange={v => setPecActif(v)}
        />
        <Row
          label="Montant du frais additionnel"
          desc={pecActif === 'true' ? `Actif : +${fraisPec}€ ajoutés à chaque course.` : 'Inactif — aucun frais additionnel appliqué pour l\'instant.'}
          name="tarif_frais_pec"
          value={p?.tarif_frais_pec ?? 0}
          isActive={pecActif === 'true'}
          onChange={v => setFraisPec(Number(v))}
        />
      </Section>

      {/* Frais d'étape */}
      <Section title="Frais d'étape intermédiaire">
        <Row
          label={`Frais par étape (actuellement ${etape}€)`}
          desc={`Ajouté au prix total lorsqu'un arrêt intermédiaire est demandé. Le calcul des km réels du détour s'ajoute en plus.`}
          name="supplement_etape"
          value={p?.supplement_etape ?? 10}
          isActive={etape > 0}
          onChange={v => setEtape(Number(v))}
        />
        {etape === 0 && (
          <div style={{ fontSize: 11, color: 'var(--amber)', padding: '6px 12px', background: 'rgba(232,160,48,.08)', borderRadius: 8 }}>
            ⚠ Frais à 0€ : l'étape ajoute uniquement les km du détour, sans surcoût fixe.
          </div>
        )}
      </Section>

      {/* Suppléments */}
      <Section title="Suppléments horaires (% ajouté au prix de base)">
        <Row
          label={`Supplément nuit${nuit > 0 ? ` — +${nuit}%` : ' — Inactif'}`}
          desc="Appliqué sur les courses démarrant entre 22h00 et 06h00. Ex : une course à 100€ devient 120€ avec 20%."
          name="supplement_nuit"
          unit="%"
          value={p?.supplement_nuit ?? 0}
          isActive={nuit > 0}
          onChange={v => setNuit(Number(v))}
        />
        <Row
          label={`Supplément week-end${weekend > 0 ? ` — +${weekend}%` : ' — Inactif'}`}
          desc="Appliqué sur les courses du samedi et dimanche. 0 = pas de supplément week-end."
          name="supplement_weekend"
          unit="%"
          value={p?.supplement_weekend ?? 0}
          isActive={weekend > 0}
          onChange={v => setWeekend(Number(v))}
        />
        <Row
          label={`Supplément jours fériés${ferie > 0 ? ` — +${ferie}%` : ' — Inactif'}`}
          desc="Appliqué sur les courses les jours fériés français. 0 = pas de supplément."
          name="supplement_ferie"
          unit="%"
          value={p?.supplement_ferie ?? 0}
          isActive={ferie > 0}
          onChange={v => setFerie(Number(v))}
        />
        {nuit === 0 && weekend === 0 && ferie === 0 && (
          <div style={{ fontSize: 11, color: 'var(--t3)', padding: '6px 12px', background: 'rgba(132,132,153,.06)', borderRadius: 8 }}>
            Tous les suppléments sont à 0 — aucune majoration horaire appliquée.
          </div>
        )}
      </Section>

      {/* Coefficients véhicules */}
      <Section title="Coefficients véhicules (appliqués sur le prix Berline de la grille)">
        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4, padding: '8px 12px', background: 'rgba(201,168,76,.04)', borderRadius: 8 }}>
          Ces coefficients s'appliquent uniquement sur les entrées de la <strong>matrice tarifaire</strong> (grille zone à zone). Les colonnes "tarif fixe aéroport" de chaque véhicule sont indépendantes.
        </div>
        <Row
          label={`Berline — coefficient ${coefB}×`}
          desc={`Prix Berline = prix grille × ${coefB}. Laisser à 1.0 pour que la Berline suive exactement la grille.`}
          name="coef_berline"
          value={p?.coef_berline ?? 1}
          unit="×"
          onChange={v => setCoefB(Number(v))}
        />
        <Row
          label={`Berline Premium — coefficient ${coefBP}×`}
          desc={`Prix Berline Premium = prix grille × ${coefBP}. Exemple : grille 100€ → ${Math.round(100 * coefBP)}€ en Berline Premium.`}
          name="coef_berline_premium"
          value={p?.coef_berline_premium ?? 1.25}
          unit="×"
          onChange={v => setCoefBP(Number(v))}
        />
        <Row
          label={`Van 7 places — coefficient ${coefV}×`}
          desc={`Prix Van = prix grille × ${coefV}. Exemple : grille 100€ → ${Math.round(100 * coefV)}€ en Van.`}
          name="coef_van"
          value={p?.coef_van ?? 1.5}
          unit="×"
          onChange={v => setCoefV(Number(v))}
        />
      </Section>

      {error && (
        <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)', color: 'var(--red)', fontSize: 12 }}>
          Erreur : {error}
        </div>
      )}
      {saved && (
        <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)', color: 'var(--green)', fontSize: 12 }}>
          ✓ Paramètres enregistrés — les prix sont mis à jour immédiatement sur tout le site.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="save-btn"
        style={{
          marginTop: 24, padding: '11px 28px', borderRadius: 8,
          background: pending ? 'var(--elevated)' : 'var(--gold)',
          color: pending ? 'var(--t2)' : 'var(--base)',
          fontSize: 13, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
          transition: 'background .15s',
        }}
      >
        {pending ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </form>
  )
}
