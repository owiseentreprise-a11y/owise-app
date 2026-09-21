'use server'

import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/supabase/server'
import { envoyerConfirmationClient, envoyerNotificationAdmin, envoyerNotificationChauffeur, envoyerBienvenueClient } from '@/lib/email'
import { getUserEmail, createAdminClient } from '@/lib/supabase/admin'
import { afficherPrixPourClient } from '@/lib/affichagePrix'

export async function creerCourseAction(formData: FormData): Promise<{ error?: string } | void> {
  const supabase = await requireAdminClient()

  const adresse_depart  = formData.get('adresse_depart') as string
  const adresse_arrivee = formData.get('adresse_arrivee') as string
  const date_prevue     = formData.get('date_prevue') as string
  const type_vehicule   = formData.get('type_vehicule') as string
  const nb_passagers    = parseInt(formData.get('nb_passagers') as string, 10) || 1
  const prix_estime_raw = formData.get('prix_estime') as string
  const prix_estime     = prix_estime_raw ? parseFloat(prix_estime_raw) : null
  const notes           = (formData.get('notes') as string) || null
  const client_id        = (formData.get('client_id') as string) || null
  const chauffeur_id     = (formData.get('chauffeur_id') as string) || null
  const collaborateur_id = (formData.get('collaborateur_id') as string) || null
  const sous_traitant_id    = (formData.get('sous_traitant_id') as string) || null
  const etapesRaw = (formData.get('etapes') as string) || '[]'
  let etapes: string[] = []
  try { etapes = JSON.parse(etapesRaw).filter((e: string) => e.trim()) } catch { etapes = [] }
  const allerRetour   = formData.get('aller_retour') === 'true'
  const dateRetourRaw = (formData.get('date_retour') as string) || ''
  // Adresse d'arrivée du retour, si le client ne rentre pas là d'où il est parti.
  // Vide = comportement historique, on inverse simplement les adresses.
  const arriveeRetour = ((formData.get('adresse_arrivee_retour') as string) || '').trim()
  const num_vol_train    = (formData.get('num_vol_train') as string) || null
  const terminal_val     = (formData.get('terminal') as string) || null
  const heure_arrivee_vol = (formData.get('heure_arrivee_vol') as string) || null
  const prix_sous_traitant_raw = formData.get('prix_sous_traitant') as string
  const prix_sous_traitant  = prix_sous_traitant_raw ? parseFloat(prix_sous_traitant_raw) : null
  const passager_mode   = (formData.get('passager_mode') as string) || 'compte'
  const passager_prenom = passager_mode === 'libre' ? ((formData.get('passager_prenom') as string) || null) : null
  const passager_nom    = passager_mode === 'libre' ? ((formData.get('passager_nom')    as string) || null) : null
  const passager_tel    = passager_mode === 'libre' ? ((formData.get('passager_tel')    as string) || null) : null
  const passager_email  = passager_mode === 'libre' ? ((formData.get('passager_email')  as string) || null) : null
  const creer_compte    = passager_mode === 'libre' && formData.get('creer_compte') === 'true' && !!passager_email

  // Course réservée par téléphone, réalisée, puis saisie après coup pour être
  // facturée. Sans cette case, la date passée était refusée et le cas — courant —
  // n'avait aucune solution dans l'interface.
  const deja_effectuee = formData.get('deja_effectuee') === 'on' || formData.get('deja_effectuee') === 'true'
  const mode_paiement  = deja_effectuee ? ((formData.get('mode_paiement') as string) || null) : null

  if (!adresse_depart || !adresse_arrivee || !date_prevue || !type_vehicule) {
    return { error: 'Champs obligatoires manquants' }
  }

  const dateParsed = new Date(date_prevue)
  if (!deja_effectuee && dateParsed < new Date(Date.now() - 15 * 60_000)) {
    return { error: 'La date de prise en charge est dans le passé. Pour une course déjà réalisée, cochez « course déjà effectuée ».' }
  }
  if (deja_effectuee && dateParsed > new Date()) {
    return { error: 'Une course déjà effectuée ne peut pas avoir une date future.' }
  }

  const { error, data: newCourse } = await supabase.from('courses').insert({
    adresse_depart,
    adresse_arrivee,
    date_prevue,
    type_vehicule,
    nb_passagers,
    prix_estime,
    notes,
    client_id: passager_mode === 'libre' ? null : client_id,
    chauffeur_id: sous_traitant_id ? null : chauffeur_id,
    collaborateur_id: passager_mode === 'libre' ? null : collaborateur_id,
    sous_traitant_id,
    prix_sous_traitant: sous_traitant_id ? prix_sous_traitant : null,
    etapes: etapes.length > 0 ? etapes : null,
    num_vol_train,
    terminal: terminal_val,
    heure_arrivee_vol,
    passager_prenom,
    passager_nom,
    passager_tel,
    passager_email,
    // Une course déjà réalisée entre directement en « terminée », avec son
    // horaire réel : elle apparaît ainsi dans l'historique et les statistiques,
    // et devient facturable immédiatement.
    statut: deja_effectuee ? 'terminee' : 'en_attente',
    ...(deja_effectuee ? {
      // Même valeur brute que date_prevue, volontairement. L'application stocke
      // les horaires sans fuseau et les réaffiche tels quels : passer par
      // toISOString() les décalerait de l'offset du serveur et les trois dates
      // d'une même course ne concorderaient plus.
      date_debut: date_prevue,
      date_fin:   date_prevue,
      mode_paiement,
      // « paye » empêche aussi la facturation mensuelle de la reprendre :
      // une course déjà encaissée ne doit pas être refacturée.
      paiement_statut: mode_paiement ? 'paye' : 'a_percevoir',
      paiement_a_bord: mode_paiement === 'tpe_bord' || mode_paiement === 'especes',
    } : {}),
  }).select('id').single()

  if (error) return { error: error.message }

  // Création automatique du compte client si email fourni et case cochée
  let nouveauClientId: string | null = null
  if (creer_compte && passager_email && newCourse) {
    try {
      const adminClient = createAdminClient()

      // Vérifier si le client existe déjà (email déjà enregistré)
      const rpcResult = await adminClient.rpc('find_user_by_email', { p_email: passager_email })
      const existingId: string | null = rpcResult.error ? null : (rpcResult.data as string | null)

      if (existingId) {
        // Client existant → lier simplement la course sans recréer de compte ni renvoyer d'email
        nouveauClientId = existingId
        await supabase.from('courses').update({
          client_id: nouveauClientId,
          passager_prenom: null, passager_nom: null, passager_tel: null,
        }).eq('id', newCourse.id)
      } else {
        // Nouveau client → créer le compte et envoyer l'email de bienvenue
        const motDePasse = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!2'
        const { data: newUser } = await adminClient.auth.admin.createUser({
          email: passager_email,
          password: motDePasse,
          email_confirm: true,
          app_metadata: { role: 'client' },
        })
        if (newUser?.user?.id) {
          nouveauClientId = newUser.user.id
          await Promise.all([
            adminClient.from('profiles').upsert({ id: nouveauClientId, prenom: passager_prenom ?? '', nom: passager_nom ?? '', telephone: passager_tel ?? null }, { onConflict: 'id' }),
            adminClient.from('clients').upsert({ id: nouveauClientId, type_compte: 'particulier' }, { onConflict: 'id' }),
          ])
          await supabase.from('courses').update({
            client_id: nouveauClientId,
            passager_prenom: null, passager_nom: null, passager_tel: null,
          }).eq('id', newCourse.id)
          await envoyerBienvenueClient({
            email: passager_email,
            prenom: passager_prenom ?? '',
            nom: passager_nom ?? '',
            password: motDePasse,
            typeCompte: 'particulier',
          })
        }
      }
    } catch { /* non bloquant */ }
  }

  // Retour — adresses inversées
  if (allerRetour && dateRetourRaw && newCourse) {
    const dateRetourParsed = new Date(dateRetourRaw)
    if (!isNaN(dateRetourParsed.getTime())) {
      await supabase.from('courses').insert({
        adresse_depart:    adresse_arrivee,
        adresse_arrivee:   arriveeRetour || adresse_depart,
        etapes:            etapes.length > 0 ? [...etapes].reverse() : null,
        date_prevue:       dateRetourParsed.toISOString(),
        type_vehicule,
        nb_passagers,
        prix_estime:       prix_estime,
        notes:             notes ? `Retour — ${notes}` : 'Retour',
        client_id: passager_mode === 'libre' ? null : client_id,
        collaborateur_id: passager_mode === 'libre' ? null : collaborateur_id,
        chauffeur_id:      sous_traitant_id ? null : chauffeur_id,
        sous_traitant_id,
        prix_sous_traitant: sous_traitant_id ? prix_sous_traitant : null,
        passager_prenom,
        passager_nom,
        passager_tel,
        passager_email,
        statut:            'en_attente',
      })
    }
  }

  const refCourse = (newCourse?.id ?? '').slice(-6).toUpperCase()

  // Notifier le chauffeur si assigné à la création
  if (chauffeur_id && !sous_traitant_id) {
    const adminClient = createAdminClient()
    const [chauffeurEmail, chauffeurProfileRes] = await Promise.all([
      getUserEmail(chauffeur_id),
      adminClient.from('profiles').select('prenom').eq('id', chauffeur_id).single(),
    ])
    if (chauffeurEmail) {
      await envoyerNotificationChauffeur({
        chauffeurEmail,
        chauffeurPrenom: chauffeurProfileRes.data?.prenom ?? '',
        adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
        datePrevue: date_prevue, clientNom: '—',
        nbPassagers: nb_passagers, notes: notes ?? null, refCourse,
        etapes: etapes.length > 0 ? etapes : null,
      })
    }
  }

  // Compte lié à la course, une fois toute la logique de création/liaison ci-dessus
  // passée — un client existant sélectionné, ou un compte lié/créé en saisie libre.
  // Sans ça, une saisie libre avec email mais sans "créer un compte" ne notifiait
  // jamais personne (ni client, ni admin) alors que l'email était bien saisi.
  const effectiveClientId = nouveauClientId ?? (passager_mode === 'libre' ? null : client_id)

  let clientEmail: string | null = null
  let clientPrenom = ''
  let clientNomComplet = '—'
  // Par défaut on affiche le prix ; masqué seulement si le client le demande
  // ou s'il s'agit d'une entreprise (cf. afficherPrixPourClient).
  let afficherPrix = true

  if (effectiveClientId) {
    const [emailResult, profileRes, clientRes] = await Promise.all([
      getUserEmail(effectiveClientId),
      supabase.from('profiles').select('prenom, nom').eq('id', effectiveClientId).single(),
      // select('*') volontaire : afficher_prix peut ne pas encore exister en
      // base, un select explicite ferait échouer toute la création de course.
      supabase.from('clients').select('*').eq('id', effectiveClientId).single(),
    ])
    clientEmail = emailResult
    clientPrenom = profileRes.data?.prenom ?? ''
    clientNomComplet = clientRes.data?.type_compte === 'entreprise'
      ? (clientRes.data.entreprise_nom ?? clientPrenom)
      : (`${clientPrenom} ${profileRes.data?.nom ?? ''}`.trim() || '—')
    afficherPrix = afficherPrixPourClient(clientRes.data)

    // Réservation faite pour un collaborateur : c'est lui qui voyage, donc lui
    // qui reçoit la confirmation — sans le montant. Repli sur le compte de
    // l'entreprise si son email n'est pas renseigné, sinon personne n'est averti.
    if (collaborateur_id) {
      const { data: collab } = await supabase
        .from('collaborateurs').select('prenom, nom, email').eq('id', collaborateur_id).single()
      if (collab?.email) {
        clientEmail = collab.email
        clientPrenom = collab.prenom ?? clientPrenom
      }
    }
  } else if (passager_mode === 'libre' && passager_email) {
    // Pas de compte créé/lié, mais un email a bien été saisi — on peut quand
    // même envoyer la confirmation directement, sans passer par un client_id.
    clientEmail = passager_email
    clientPrenom = passager_prenom ?? ''
    clientNomComplet = `${passager_prenom ?? ''} ${passager_nom ?? ''}`.trim() || '—'
  }

  // La notification admin part toujours, avec ou sans email client identifié —
  // c'est le seul filet de sécurité pour repérer une course créée sans aucun
  // contact passager renseigné.
  await Promise.all([
    // Pas de confirmation de réservation pour une course déjà réalisée : le
    // client recevrait la confirmation d'un trajet qu'il vient de faire. Il
    // recevra la facture à la place.
    clientEmail && !deja_effectuee ? envoyerConfirmationClient({
      clientEmail, clientPrenom,
      adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
      datePrevue: date_prevue, typeVehicule: type_vehicule,
      nbPassagers: nb_passagers, prixEstime: prix_estime, refCourse,
      etapes: etapes.length > 0 ? etapes : null,
      // Le retour existe en base mais n'apparaissait pas dans la confirmation :
      // le client ignorait qu'il était réservé.
      retour: allerRetour && dateRetourRaw && !isNaN(new Date(dateRetourRaw).getTime())
        ? { datePrevue: new Date(dateRetourRaw).toISOString(), adresseArrivee: arriveeRetour || undefined }
        : null,
      afficherPrix,
    }) : Promise.resolve(),
    envoyerNotificationAdmin({
      adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
      datePrevue: date_prevue, clientNom: clientNomComplet, typeVehicule: type_vehicule, refCourse,
    }),
  ])

  redirect('/admin/courses')
}
