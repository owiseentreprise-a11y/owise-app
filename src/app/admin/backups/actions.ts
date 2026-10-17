'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { runBackup } from '@/lib/backup'

export async function triggerBackupAction(): Promise<{ ok: boolean; filename?: string; error?: string }> {
  /**
   * Seul fichier d'actions sous `src/app/admin/**` qui n'avait aucune
   * vérification d'identité — 13 sur 14 la portaient. La protection venait
   * uniquement du `matcher` de `src/proxy.ts`, extérieur à l'action : une
   * refonte du routage l'aurait ouverte sans que rien ne le signale.
   *
   * Ce que cette action déclenche justifie la défense en profondeur :
   * `runBackup()` fait un `select('*')` sur chaque table avec la clé de
   * service et dépose le résultat dans le stockage.
   *
   * L'appel est AVANT le `try` à dessein. `requireAdminClient()` refuse en
   * appelant `redirect('/login')`, qui lève une exception interne à Next.
   * Placé dans le bloc `try`, le `catch` l'intercepterait, annulerait la
   * redirection et renverrait un simple `{ ok: false }` — le refus
   * deviendrait un message d'erreur, et l'appelant non autorisé resterait
   * sur place.
   */
  await requireAdminClient()

  try {
    const result = await runBackup()
    revalidatePath('/admin/backups')
    return { ok: true, filename: result.filename }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
