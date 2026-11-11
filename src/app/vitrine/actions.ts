'use server'

import { randomUUID } from 'crypto'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerNouveauDevis } from '@/lib/email'
import { capiLead } from '@/lib/capi'

export async function soumettreDevis(params: {
  nom: string
  tel: string
  email: string
  societe?: string | null
  origin: string
  destination: string
  date_course?: string | null
  heure?: string | null
  pax: number
  vehicle: string
  price?: number | null
  supplements?: string[] | null
  dest_type?: string | null
}) {
  const sb = createAdminClient()

  const { error } = await sb.from('devis').insert({
    nom:         params.nom,
    tel:         params.tel,
    email:       params.email,
    societe:     params.societe ?? null,
    origin:      params.origin,
    destination: params.destination,
    date_course: params.date_course ?? null,
    heure:       params.heure ?? null,
    pax:         params.pax,
    vehicle:     params.vehicle,
    price:       params.price ?? null,
    supplements: params.supplements?.length ? params.supplements : null,
    dest_type:   params.dest_type ?? null,
  })

  if (error) throw new Error(error.message)

  // Extraire les signaux navigateur pour améliorer le taux de correspondance CAPI
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const fbp       = cookieStore.get('_fbp')?.value
  const fbc       = cookieStore.get('_fbc')?.value
  const rawIp     = headerStore.get('x-forwarded-for')
  const clientIp  = rawIp ? rawIp.split(',')[0].trim() : undefined
  const userAgent = headerStore.get('user-agent') ?? undefined

  // CAPI Lead — en arrière-plan, ne bloque pas la réponse
  capiLead({
    eventId   : randomUUID(),
    email     : params.email,
    phone     : params.tel,
    firstName : params.nom,
    value     : params.price ?? undefined,
    currency  : 'EUR',
    fbp,
    fbc,
    clientIp,
    userAgent,
    sourceUrl : 'https://owise.fr',
  }).catch((e) => {
    /* Même raison : une mesure perdue en silence se découvre des mois
       plus tard, en cherchant pourquoi les chiffres ne tombent pas. */
    console.error('[MESURE META NON PARTIE]', e)
  })

  /* L'ALERTE À L'EXPLOITANT, et sa trace en cas d'échec.

     Elle partait déjà — mon premier repérage avait conclu l'inverse, à
     tort. Le vrai défaut est le `.catch(() => {})` qui était ici : il
     avalait TOUT échec d'envoi sans un mot. Si Resend refuse, si la clé
     expire, si l'adresse change, la demande du client arrive en base et
     personne n'est prévenu — et personne ne peut savoir pourquoi.

     L'exploitant, le 2026-11-11 : « est-ce que je pourrais recevoir une
     notification quand je reçois une demande de devis en ligne ». La
     réponse est oui, elle existe ; encore faut-il pouvoir vérifier
     qu'elle est partie. Le marqueur se cherche dans les journaux Vercel.

     L'envoi reste en arrière-plan : une alerte qui échoue ne doit jamais
     empêcher la demande du client de passer. */
  envoyerNouveauDevis(params).catch((e) => {
    console.error('[ALERTE DEVIS NON PARTIE]', params.email, e)
  })

  return { ok: true }
}
