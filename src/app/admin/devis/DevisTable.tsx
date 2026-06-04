'use client'

import { useState, useTransition } from 'react'
import { supprimerDevis, convertirEnFacture } from './actions'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDateCourse(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const VEHICULE_LABEL: Record<string, string> = {
  'Berline': 'Berline', 'Berline Premium': 'Premium',
  'Van 7 places': 'Van 7', 'Grand Van': 'Grand Van',
}

function DevisRow({ d, isLast }: { d: any; isLast: boolean }) {
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm]      = useState<'delete' | 'facture' | null>(null)
  const [success, setSuccess]      = useState<string | null>(null)

  function handleSupprimer() {
    startTransition(async () => {
      await supprimerDevis(d.id)
    })
  }

  function handleConvertir() {
    startTransition(async () => {
      try {
        const num = await convertirEnFacture({
          id: d.id, nom: d.nom, email: d.email, price: d.price,
          origin: d.origin, destination: d.destination,
          date_course: d.date_course, vehicle: d.vehicle,
        })
        setSuccess(num)
        setConfirm(null)
      } catch (e: any) {
        alert(e.message)
      }
    })
  }

  if (success) {
    return (
      <tr style={{ background: 'rgba(61,184,122,.04)', borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,.05)' }}>
        <td colSpan={10} style={{ padding: '14px 20px', fontSize: 13, color: '#3DB87A', fontWeight: 500 }}>
          ✓ Facture <span style={{ fontFamily: 'monospace' }}>{success}</span> créée — devis supprimé
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,.05)', opacity: pending ? .5 : 1, transition: 'opacity .15s' }}>
      {/* Date */}
      <td style={{ padding: '13px 14px', fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>{fmtDate(d.created_at)}</td>
      {/* Client */}
      <td style={{ padding: '13px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A' }}>{d.nom || '—'}</div>
        {d.societe && <div style={{ fontSize: 10, color: '#C9A84C', marginTop: 2 }}>{d.societe}</div>}
      </td>
      {/* Tel */}
      <td style={{ padding: '13px 14px' }}>
        {d.tel ? (
          <a href={`tel:${d.tel}`} style={{ fontSize: 12, color: '#0A0A0A', textDecoration: 'none', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#3DB87A" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            {d.tel}
          </a>
        ) : '—'}
      </td>
      {/* Email */}
      <td style={{ padding: '13px 14px' }}>
        {d.email ? <a href={`mailto:${d.email}`} style={{ fontSize: 11, color: '#4D8ED4', textDecoration: 'none', maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</a> : '—'}
      </td>
      {/* Trajet */}
      <td style={{ padding: '13px 14px', maxWidth: 180 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DB87A', flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{d.origin || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{d.destination || '—'}</span>
          </div>
        </div>
      </td>
      {/* Véhicule */}
      <td style={{ padding: '13px 14px' }}>
        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 500, background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}>
          {VEHICULE_LABEL[d.vehicle] ?? d.vehicle ?? '—'}
        </span>
      </td>
      {/* Prix */}
      <td style={{ padding: '13px 14px' }}>
        {d.price ? <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0A0A0A' }}>{d.price} €</span> : '—'}
      </td>
      {/* Pax */}
      <td style={{ padding: '13px 14px', fontSize: 12, color: '#666', textAlign: 'center' }}>{d.pax ?? '—'}</td>
      {/* Date course */}
      <td style={{ padding: '13px 14px', fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
        {fmtDateCourse(d.date_course)}
        {d.heure && <span style={{ color: '#999', marginLeft: 4 }}>{d.heure}</span>}
      </td>
      {/* Actions */}
      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
        {confirm === null && (
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Convertir en facture */}
            <button onClick={() => setConfirm('facture')} disabled={pending || !d.price}
              title={!d.price ? 'Prix manquant' : 'Convertir en facture'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(77,142,212,.3)',
                background: 'rgba(77,142,212,.06)', color: '#4D8ED4',
                fontSize: 11, fontWeight: 500, cursor: d.price ? 'pointer' : 'not-allowed',
                opacity: d.price ? 1 : .4, fontFamily: 'inherit',
              }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Facture
            </button>
            {/* Supprimer */}
            <button onClick={() => setConfirm('delete')} disabled={pending}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(217,84,84,.2)',
                background: 'rgba(217,84,84,.05)', color: '#D95454',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        )}

        {/* Confirmation supprimer */}
        {confirm === 'delete' && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#D95454', fontWeight: 600 }}>Supprimer ?</span>
            <button onClick={handleSupprimer} disabled={pending}
              style={{ padding: '4px 8px', borderRadius: 5, background: '#D95454', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Oui
            </button>
            <button onClick={() => setConfirm(null)}
              style={{ padding: '4px 8px', borderRadius: 5, background: 'rgba(0,0,0,.06)', color: '#666', border: 'none', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
              Non
            </button>
          </div>
        )}

        {/* Confirmation facture */}
        {confirm === 'facture' && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#4D8ED4', fontWeight: 600 }}>Créer facture {d.price}€ ?</span>
            <button onClick={handleConvertir} disabled={pending}
              style={{ padding: '4px 8px', borderRadius: 5, background: '#4D8ED4', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Oui
            </button>
            <button onClick={() => setConfirm(null)}
              style={{ padding: '4px 8px', borderRadius: 5, background: 'rgba(0,0,0,.06)', color: '#666', border: 'none', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
              Non
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function DevisTable({ devis }: { devis: any[] }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F8F6F1', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
            {['Date', 'Client', 'Téléphone', 'Email', 'Trajet', 'Véhicule', 'Prix', 'Pax', 'Date course', 'Actions'].map(h => (
              <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#999', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devis.map((d, i) => <DevisRow key={d.id} d={d} isLast={i === devis.length - 1} />)}
        </tbody>
      </table>
    </div>
  )
}
