/**
 * Le lien privé par lequel un client accepte son devis lui-même.
 *
 * POURQUOI
 *
 * L'exploitant, le 2026-11-11 : « une fois qu'on a accepté, on lui envoie
 * l'acceptation, mais elle doit mettre sa carte bleue pour valider la
 * réservation ». Jusqu'ici le client n'avait aucun moyen de s'engager :
 * c'était l'exploitant qui décidait seul, dans l'administration, que le devis
 * était accepté. Le client ne recevait rien, ne cliquait sur rien, ne payait
 * rien.
 *
 * POURQUOI UN JETON, ET PAS L'IDENTIFIANT DU DEVIS
 *
 * La page est PUBLIQUE : le client n'a pas de compte, et lui en demander un
 * pour accepter un devis ferait fuir la moitié des gens. L'adresse doit donc
 * être impossible à deviner. L'identifiant du devis circule déjà dans
 * l'administration et dans des liens internes ; un UUID tiré au hasard, qui
 * ne sert qu'à ça, ne révèle rien et ne permet pas de passer d'un devis au
 * suivant.
 *
 * Le jeton est posé À LA DEMANDE, au moment où l'on envoie le lien, et jamais
 * repris ensuite : un devis garde le sien pour toujours, de sorte qu'un
 * client qui rouvre un vieux message retombe sur son devis et non sur une
 * page morte.
 */
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Le jeton de ce devis, créé s'il n'en a pas encore.
 *
 * Renvoie toujours le même pour un devis donné.
 */
export async function assurerJeton(devisId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('devis_clients')
    .select('jeton')
    .eq('id', devisId)
    .single()

  if (error || !data) throw new Error('Devis introuvable.')
  if (data.jeton) return data.jeton as string

  const jeton = randomUUID()
  const { error: erreurEcriture } = await supabase
    .from('devis_clients')
    .update({ jeton })
    .eq('id', devisId)
    /* On n'écrase jamais un jeton déjà posé : si deux envois partent en même
       temps, le second ne doit pas invalider le lien du premier. */
    .is('jeton', null)

  if (erreurEcriture) throw new Error(erreurEcriture.message)

  /* Relecture : la condition `.is('jeton', null)` a pu ne toucher aucune
     ligne parce qu'un autre appel est passé avant. C'est SON jeton qui fait
     foi, pas celui qu'on vient de tirer. */
  const { data: relu } = await supabase
    .from('devis_clients')
    .select('jeton')
    .eq('id', devisId)
    .single()

  return (relu?.jeton as string) ?? jeton
}

/** L'adresse complète à remettre au client. */
export function lienAcceptation(jeton: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  return `${site}/devis/${jeton}`
}
