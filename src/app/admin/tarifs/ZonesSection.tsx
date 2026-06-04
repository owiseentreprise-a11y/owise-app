'use client'

import { useState, useTransition } from 'react'
import { updateZone, deleteZone, addZone, toggleZoneActive } from './actions'

type Zone = {
  id: string
  code: string
  nom: string
  type: string
  active?: boolean
  prefixes_postaux: string[]
}

const inp: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'var(--font-jetbrains), monospace',
}

const TYPE_LABEL: Record<string, string> = {
  zone:      'Zone',
  aeroport:  'Aéroport',
  gare:      'Gare',
  hors_zone: 'Hors zone',
}

const TYPE_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  aeroport:  { color: 'var(--blu)', bg: 'rgba(77,142,212,.12)',  border: 'rgba(77,142,212,.2)' },
  gare:      { color: 'var(--amb)', bg: 'rgba(232,160,48,.12)',  border: 'rgba(232,160,48,.2)' },
  hors_zone: { color: 'var(--red)', bg: 'rgba(217,80,80,.08)',   border: 'rgba(217,80,80,.15)' },
  zone:      { color: 'var(--t2)', bg: 'rgba(132,132,153,.08)',  border: 'rgba(132,132,153,.15)' },
}

function ZoneRow({ zone }: { zone: Zone }) {
  const [editing,      setEditing]      = useState(false)
  const [confirming,   setConfirming]   = useState(false)
  const [pending,      startTransition] = useTransition()

  const [nom,      setNom]      = useState(zone.nom)
  const [code,     setCode]     = useState(zone.code)
  const [type,     setType]     = useState(zone.type)
  const [prefixes, setPrefixes] = useState((zone.prefixes_postaux ?? []).join(', '))

  function handleSave() {
    startTransition(async () => {
      await updateZone(zone.id, { nom, code, type, prefixes })
      setEditing(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteZone(zone.id)
    })
  }

  function handleCancel() {
    setNom(zone.nom)
    setCode(zone.code)
    setType(zone.type)
    setPrefixes((zone.prefixes_postaux ?? []).join(', '))
    setEditing(false)
    setConfirming(false)
  }

  const tc = TYPE_COLOR[zone.type] ?? TYPE_COLOR.zone

  if (editing) {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 8,
        background: 'rgba(201,168,76,.04)',
        border: '1px solid rgba(201,168,76,.15)',
        marginBottom: 6,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Code</div>
            <input style={inp} value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nom</div>
            <input style={inp} value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Type</div>
            <select style={{ ...inp, cursor: 'pointer' }} value={type} onChange={e => setType(e.target.value)}>
              <option value="zone">Zone</option>
              <option value="aeroport">Aéroport</option>
              <option value="gare">Gare</option>
              <option value="hors_zone">Hors zone</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>Préfixes (séparés par ,)</div>
            <input style={inp} value={prefixes} onChange={e => setPrefixes(e.target.value)} placeholder="75, 92, 93" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={pending}
            style={{
              padding: '6px 16px', borderRadius: 6,
              background: 'var(--gold)', color: 'var(--base)',
              fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              opacity: pending ? .6 : 1,
            }}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '6px 14px', borderRadius: 6,
              background: 'transparent', color: 'var(--t2)',
              fontSize: 11, border: '1px solid var(--t3)', cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  if (confirming) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(217,80,80,.06)',
        border: '1px solid rgba(217,80,80,.2)',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 12, color: 'var(--red)' }}>
          Supprimer <strong>{zone.nom}</strong> et toutes ses cellules tarifaires ?
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDelete}
            disabled={pending}
            style={{
              padding: '5px 14px', borderRadius: 6,
              background: 'var(--red)', color: '#fff',
              fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
            }}
          >
            {pending ? '…' : 'Confirmer'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{
              padding: '5px 12px', borderRadius: 6,
              background: 'transparent', color: 'var(--t2)',
              fontSize: 11, border: '1px solid var(--t3)', cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  const isActive = zone.active !== false

  return (
    <div className="zone-row" style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 110px 1fr auto',
      alignItems: 'center', gap: 14, padding: '10px 12px',
      borderBottom: '1px solid rgba(201,168,76,.05)', borderRadius: 6,
      opacity: isActive ? 1 : 0.45,
      transition: 'opacity .2s',
    }}>
      <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--t3)' }}>
        {zone.code}
      </div>
      <div style={{ fontSize: 12, color: 'var(--t1)' }}>{zone.nom}</div>
      <div style={{
        fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
        color: tc.color, background: tc.bg, border: `1px solid ${tc.border}`,
        textAlign: 'center',
      }}>
        {TYPE_LABEL[zone.type] ?? zone.type}
      </div>
      <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(zone.prefixes_postaux as string[]).join(', ') || '—'}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Toggle actif/inactif */}
        <button
          onClick={() => startTransition(() => toggleZoneActive(zone.id, !isActive))}
          title={isActive ? 'Désactiver' : 'Activer'}
          disabled={pending}
          style={{
            width: 42, height: 24, borderRadius: 12, cursor: 'pointer', border: 'none',
            background: isActive ? 'rgba(61,184,122,.25)' : 'rgba(132,132,153,.18)',
            position: 'relative', transition: 'background .2s', flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: isActive ? 20 : 3,
            width: 18, height: 18, borderRadius: '50%',
            background: isActive ? '#3DB87A' : 'var(--t3)',
            transition: 'left .2s, background .2s',
            display: 'block',
          }}/>
        </button>
        <button
          onClick={() => setEditing(true)}
          title="Modifier"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.15)',
            color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,168,76,.08)')}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button
          onClick={() => setConfirming(true)}
          title="Supprimer"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.15)',
            color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(217,80,80,.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(217,80,80,.08)')}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function ZonesSection({ zones }: { zones: Zone[] }) {
  const [pending, startTransition] = useTransition()

  return (
    <div>
      {/* Liste des zones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
        {zones.map(z => <ZoneRow key={z.id} zone={z} />)}
      </div>

      {/* Ajouter une zone */}
      <form action={(fd) => startTransition(() => addZone(fd))}>
        <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
          Ajouter une zone
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 1fr', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--t3)', display: 'block', marginBottom: 5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Code</label>
            <input name="code" placeholder="BVA" required style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--t3)', display: 'block', marginBottom: 5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nom</label>
            <input name="nom" placeholder="Beauvais" required style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--t3)', display: 'block', marginBottom: 5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Type</label>
            <select name="type" style={{ ...inp, cursor: 'pointer' }}>
              <option value="zone">Zone</option>
              <option value="aeroport">Aéroport</option>
              <option value="gare">Gare</option>
              <option value="hors_zone">Hors zone</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--t3)', display: 'block', marginBottom: 5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Préfixes postaux (séparés par ,)</label>
            <input name="prefixes" placeholder="60, 02, 80" style={inp} />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: 14, padding: '8px 20px', borderRadius: 8,
            background: 'var(--elevated)', color: 'var(--t1)',
            border: '1px solid var(--t3)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', opacity: pending ? .6 : 1,
          }}
        >
          + Ajouter
        </button>
      </form>
    </div>
  )
}
