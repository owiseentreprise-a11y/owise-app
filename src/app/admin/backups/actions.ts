'use server'

import { revalidatePath } from 'next/cache'
import { runBackup } from '@/lib/backup'

export async function triggerBackupAction(): Promise<{ ok: boolean; filename?: string; error?: string }> {
  try {
    const result = await runBackup()
    revalidatePath('/admin/backups')
    return { ok: true, filename: result.filename }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
