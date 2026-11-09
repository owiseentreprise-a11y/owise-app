'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerBienvenueClient } from '@/lib/email'

export async function createClientAccount(formData: FormData): Promise<void> {
  await requireAdminClient()

  const email               = (formData.get('email') as string)?.trim()
  const password            = formData.get('password') as string
  const nom                 = (formData.get('nom') as string)?.trim()
  const prenom              = (formData.get('prenom') as string)?.trim()
  const telephone           = (formData.get('telephone') as string)?.trim() || null
  const type_compte         = formData.get('type_compte') as string
  const entreprise_nom      = (formData.get('entreprise_nom') as string)?.trim() || null
  const adresse_facturation = (formData.get('adresse_facturation') as string)?.trim() || null

  const admin = createAdminClient()

  /* Pourquoi une redirection et pas un `throw` — constat du 2026-11-09.
     L'exploitant a tenté de créer un client avec une adresse déjà utilisée.
     L'action lançait une exception, Next.js affichait son écran noir
     « A server error occurred » avec un numéro, et rien d'autre. Au téléphone
     avec un client, ça veut dire : « je ne peux pas vous créer, et je ne sais
     pas pourquoi ».

     On revient donc sur le formulaire avec un message en français. Les
     messages de Supabase sont en anglais et parfois techniques : on traduit
     les cas connus, et on garde le reste tel quel plutôt que de masquer une
     cause qu'on n'a pas prévue. */
  /* Une DÉCLARATION de fonction, pas une flèche : TypeScript ne reconnaît le
     type `never` comme « ne revient jamais » que sur cette forme. Avec une
     flèche, il continuait de croire que le code passait à la ligne suivante
     avec un utilisateur nul. */
  function retourErreur(message: string): never {
    redirect(`/admin/clients/nouveau?erreur=${encodeURIComponent(message)}`)
  }

  // 1. Créer le compte auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'client' },
    user_metadata: { prenom, nom },
  })
  if (authError) {
    const m = authError.message.toLowerCase()
    if (m.includes('already') || m.includes('exists') || m.includes('registered')) {
      retourErreur(`Un compte existe déjà avec l’adresse ${email}. Ouvrez sa fiche depuis la liste des clients, ou utilisez une autre adresse.`)
    }
    if (m.includes('password')) {
      retourErreur('Le mot de passe est trop court ou refusé : il faut au moins 6 caractères.')
    }
    if (m.includes('email') && (m.includes('invalid') || m.includes('valid'))) {
      retourErreur(`L’adresse e-mail « ${email} » n’est pas valide.`)
    }
    retourErreur(`Le compte n’a pas pu être créé : ${authError.message}`)
  }

  /* `createUser` peut rendre une réponse sans erreur ET sans utilisateur.
     Sans ce garde, la ligne suivante plantait — et on retombait sur l'écran
     noir qu'on vient justement de supprimer. */
  if (!authData?.user) {
    retourErreur('Le compte n’a pas pu être créé : réponse inattendue du service d’authentification. Réessayez.')
  }

  const userId = authData.user.id

  // 2. Profil
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, nom, prenom, telephone, role: 'client',
  })
  if (profileError) {
    /* On retire le compte auth qu'on vient de créer : sans ça il resterait un
       compte sans profil, invisible dans la liste et impossible à recréer —
       l'adresse serait « déjà utilisée » sans que rien ne s'affiche. */
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    retourErreur(`La fiche n’a pas pu être enregistrée : ${profileError.message}`)
  }

  // 3. Client
  const { error: clientError } = await admin.from('clients').upsert({
    id: userId,
    type_compte: type_compte || 'particulier',
    entreprise_nom,
    adresse_facturation,
  })
  if (clientError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    retourErreur(`La fiche client n’a pas pu être enregistrée : ${clientError.message}`)
  }

  envoyerBienvenueClient({
    email, prenom, nom, password,
    typeCompte: type_compte,
    entrepriseNom: entreprise_nom,
  }).catch(() => {})

  revalidatePath('/admin/clients')
  revalidatePath('/admin')
  redirect(`/admin/clients/${userId}`)
}
