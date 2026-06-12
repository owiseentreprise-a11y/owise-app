import { createAdminClient } from '@/lib/supabase/admin'
import { TriggerButton } from './TriggerButton'

export const dynamic = 'force-dynamic'

function fmtBytes(n: number) {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(2)} Mo`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type BackupFile = {
  name: string
  id: string
  created_at: string
  metadata: { size: number } | null
  signedUrl: string | null
}

export default async function BackupsPage() {
  const admin = createAdminClient()

  const { data: files, error } = await admin.storage
    .from('backups')
    .list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })

  const backups: BackupFile[] = []

  if (files && files.length > 0) {
    const signedResults = await admin.storage
      .from('backups')
      .createSignedUrls(files.map(f => f.name), 3600)

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const signed = signedResults.data?.[i]
      backups.push({
        name:      f.name,
        id:        f.id ?? f.name,
        created_at: f.created_at ?? '',
        metadata:  f.metadata as { size: number } | null,
        signedUrl: signed?.signedUrl ?? null,
      })
    }
  }

  const card = {
    background: '#FFFFFF',
    border: '1.5px solid rgba(0,0,0,.07)',
    borderRadius: 12,
    padding: '20px 24px',
  } as const

  return (
    <div style={{ padding: '32px 36px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, color: '#0A0A0A', letterSpacing: '.02em', marginBottom: 6 }}>
            Sauvegardes
          </h1>
          <p style={{ fontSize: 12, color: '#888' }}>
            Backup automatique quotidien à 3h du matin · 30 fichiers conservés · Supabase Storage
          </p>
        </div>
        <TriggerButton />
      </div>

      {/* Info card */}
      <div style={{ ...card, marginBottom: 24, background: 'rgba(201,168,76,.04)', borderColor: 'rgba(201,168,76,.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { label: 'Fréquence',         value: 'Quotidien à 3h00' },
            { label: 'Rétention',          value: '30 derniers fichiers' },
            { label: 'Tables sauvegardées', value: '14 tables' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File list */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Fichiers de backup ({backups.length})
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#D95454', padding: '10px 0' }}>
            Erreur de lecture du bucket : {error.message}
          </div>
        )}

        {!error && backups.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa', padding: '20px 0', textAlign: 'center' }}>
            Aucun backup trouvé. Cliquez sur « Créer un backup maintenant » pour générer le premier.
          </div>
        )}

        {backups.map((b, i) => (
          <div
            key={b.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: i < backups.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'rgba(201,168,76,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V9l-5-5H7c-2 0-3 1-3 3z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v5h5M9 13h6M9 17h4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', fontFamily: 'monospace' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {b.created_at ? fmtDate(b.created_at) : '—'}
                  {b.metadata?.size ? ` · ${fmtBytes(b.metadata.size)}` : ''}
                </div>
              </div>
            </div>

            {b.signedUrl ? (
              <a
                href={b.signedUrl}
                download={b.name}
                style={{
                  fontSize: 11, color: '#C9A84C', fontWeight: 600,
                  textDecoration: 'none',
                  padding: '6px 14px', borderRadius: 7,
                  border: '1px solid rgba(201,168,76,.3)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background .12s',
                }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Télécharger
              </a>
            ) : (
              <span style={{ fontSize: 11, color: '#ccc' }}>Lien expiré</span>
            )}
          </div>
        ))}
      </div>

      {/* Instructions restauration */}
      <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 10, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Comment restaurer
        </div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>
          Chaque fichier JSON contient toutes les tables Owise. Pour restaurer, ouvrez le fichier,
          copiez les données d&apos;une table, et importez-les via <strong>Supabase → Table Editor</strong> ou
          via un script SQL <code>INSERT</code>. Contactez le support technique pour une restauration complète.
        </div>
      </div>

    </div>
  )
}
