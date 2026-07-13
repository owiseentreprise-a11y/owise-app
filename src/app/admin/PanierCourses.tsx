'use client'

import Link from 'next/link'
import DispatchRapideButton from './courses/DispatchRapideButton'

type ChauffeurLean = {
  id: string
  statut: string
  profiles: { prenom: string; nom: string } | null
}

export default function PanierCourses({
  courses,
  chauffeurs,
}: {
  courses: any[]
  chauffeurs: ChauffeurLean[]
}) {
  if (courses.length === 0) return null

  return (
    <div style={{
      background: 'rgba(201,168,76,.04)',
      border: '1.5px solid rgba(201,168,76,.25)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(201,168,76,.06)',
        borderBottom: '1px solid rgba(201,168,76,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--gold)',
            boxShadow: '0 0 0 3px rgba(201,168,76,.2)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
            {courses.length} course{courses.length > 1 ? 's' : ''} en attente de chauffeur
          </span>
          <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 400 }}>
            — à dispatcher
          </span>
        </div>
        <Link href="/admin/courses" style={{
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          padding: '4px 10px', borderRadius: 6,
          border: '1px solid rgba(201,168,76,.15)',
          transition: 'color .15s',
        }}>
          Voir tout →
        </Link>
      </div>

      {/* Colonne headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 130px 100px 80px 180px',
        padding: '6px 20px',
        fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'var(--t3)', fontWeight: 500,
        borderBottom: '1px solid rgba(201,168,76,.06)',
        gap: 12,
      }}>
        <div>Trajet</div>
        <div>Client</div>
        <div>Date</div>
        <div>Prix</div>
        <div>Dispatcher</div>
      </div>

      {courses.map((c, idx) => {
        const client = c.clients
        const collab = c.collaborateurs
        const clientNom = client?.type_compte === 'entreprise'
          ? (client.entreprise_nom ?? '—')
          : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : 'Invité'
        const collabLabel = collab ? `${collab.prenom} ${collab.nom}`.trim() : null
        const date = new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
        const dateValid = !isNaN(date.getTime())
        const prix = c.prix_final ?? c.prix_estime
        const isLast = idx === courses.length - 1

        return (
          <div key={c.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 100px 80px 180px',
            padding: '12px 20px', alignItems: 'center', gap: 12,
            borderBottom: isLast ? 'none' : '1px solid rgba(201,168,76,.05)',
            transition: 'background .12s',
          }}>
            {/* Trajet */}
            <a href={`/admin/courses/${c.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                {c.adresse_depart?.split(',')[0] ?? '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                → {c.adresse_arrivee?.split(',')[0] ?? '—'}
              </div>
            </a>

            {/* Client */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clientNom}
              </div>
              {collabLabel && (
                <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 1 }}>
                  {collabLabel}
                </div>
              )}
            </div>

            {/* Date */}
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 10, color: 'var(--t3)', lineHeight: 1.5,
            }}>
              {dateValid ? (
                <>
                  <div>{date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>
                  <div>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </>
              ) : <div>—</div>}
            </div>

            {/* Prix */}
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 13, fontWeight: 500,
              color: prix != null ? 'var(--gold)' : 'var(--t3)',
            }}>
              {prix != null ? `${Number(prix).toFixed(0)} €` : '—'}
            </div>

            {/* Dispatcher */}
            <DispatchRapideButton
              courseId={c.id}
              chauffeurs={chauffeurs}
              currentChauffeurId={null}
              currentChauffeurNom={null}
            />
          </div>
        )
      })}
    </div>
  )
}
