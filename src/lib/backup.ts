import { createAdminClient } from './supabase/admin'

const TABLES = [
  'courses',
  'clients',
  'chauffeurs',
  'devis',
  'factures',
  'factures_sous_traitants',
  'sous_traitants',
  'estimations',
  'parametres',
  'tarifs',
  'grilles_tarifaires',
  'zones',
  'codes_parrainage',
  'collaborateurs',
]

export async function runBackup(): Promise<{
  filename: string
  sizeBytes: number
  stats: Record<string, number>
}> {
  const admin = createAdminClient()
  const now = new Date()
  // "2026-06-12T03-00-00" — safe for filenames
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-')

  const tableData: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select('*')
    if (!error && data) tableData[table] = data
    else tableData[table] = []
  }

  const stats = Object.fromEntries(
    Object.entries(tableData).map(([k, v]) => [k, v.length])
  )

  const payload = {
    created_at: now.toISOString(),
    project: 'owise',
    stats,
    tables: tableData,
  }

  const json = JSON.stringify(payload)
  const filename = `backup-${timestamp}.json`

  const { error: uploadError } = await admin.storage
    .from('backups')
    .upload(filename, json, { contentType: 'application/json', upsert: false })

  if (uploadError) throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)

  // Keep only the last 30 backups
  const { data: files } = await admin.storage
    .from('backups')
    .list('', { limit: 200, sortBy: { column: 'created_at', order: 'asc' } })

  if (files && files.length > 30) {
    const toDelete = files.slice(0, files.length - 30).map(f => f.name)
    await admin.storage.from('backups').remove(toDelete)
  }

  return { filename, sizeBytes: Buffer.byteLength(json), stats }
}
