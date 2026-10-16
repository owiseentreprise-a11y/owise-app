/**
 * Crée la fiche client de SKORP Production et lui rattache sa facture.
 *
 * POURQUOI CE N'ÉTAIT PAS FAIT
 *
 * La facture OW-202610-0006 (1 090 €) a été établie hors du système, à partir
 * d'un relevé de prestations. Elle est donc en base sans `client_id` — d'où
 * une ligne sans nom dans /admin/facturation, introuvable à l'œil, et un
 * document dont le PDF généré ne sait même pas à qui il s'adresse.
 *
 * CE QUE LA CRÉATION IMPLIQUE, ET POURQUOI AUCUN E-MAIL NE PART
 *
 * `clients.id` est une clé étrangère vers `profiles.id` : une fiche client ne
 * peut pas exister sans profil. Tous les clients du système en ont un, et on
 * ne fait pas d'exception ici. Le compte d'authentification est créé avec
 * `email_confirm: true`, ce qui supprime l'e-mail de confirmation que
 * Supabase enverrait sinon — la cliente ne reçoit rien et ne sait pas que ce
 * compte existe. Son mot de passe est tiré au hasard, n'est ni affiché ni
 * conservé : le compte reste dormant. Si elle veut y accéder un jour, elle
 * passe par « mot de passe oublié ».
 *
 * LES DONNÉES viennent toutes de la facture validée par l'exploitant, aucune
 * n'est devinée : SKORP Production, à l'attention de Kim, 7 rue du Colonel
 * Oudot 75012 Paris, 06 34 11 72 51, Skorp.rc@gmail.com.
 *
 *   npx tsx scripts/creer-client-skorp.mts           montre
 *   npx tsx scripts/creer-client-skorp.mts --ecrire  applique
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomBytes, randomUUID } from 'crypto'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')

const ECRIRE = process.argv.includes('--ecrire')
const admin = createAdminClient()

const EMAIL   = 'Skorp.rc@gmail.com'
const FACTURE = 'OW-202610-0006'

/* `profiles.nom` est NOT NULL — constaté en production le 2026-10-16 : le
 * compte avait déjà été créé quand l'insertion du profil a échoué. On y met la
 * raison sociale, qui est ce que les écrans affichent en repli lorsqu'ils ne
 * trouvent pas `entreprise_nom`. */
const PROFIL = { role: 'client', prenom: 'Kim', nom: 'SKORP Production', telephone: '+33634117251' }
const FICHE  = {
  type_compte:         'entreprise',
  entreprise_nom:      'SKORP Production',
  adresse_facturation: '7 rue du Colonel Oudot, 75012 Paris',
  prenom:              'Kim',
  email:               EMAIL,
  tel:                 '+33634117251',
  statut:              'actif',
  facturation_mode:    'mensuelle',
}

/* Déjà là ? On ne crée pas un doublon d'un client existant. */
const { data: existant } = await admin.from('clients').select('id, entreprise_nom, email').ilike('email', EMAIL)
if (existant?.length) {
  console.log(`ARRÊT — une fiche existe déjà pour ${EMAIL} : ${existant[0].entreprise_nom ?? existant[0].id}`)
  process.exit(1)
}

const { data: facture } = await admin.from('factures').select('id, numero, client_id, montant_ttc').eq('numero', FACTURE).single()
if (!facture) { console.log(`ARRÊT — facture ${FACTURE} introuvable.`); process.exit(1) }
if (facture.client_id) { console.log(`ARRÊT — ${FACTURE} est déjà rattachée au client ${facture.client_id}.`); process.exit(1) }

console.log('FICHE CLIENT À CRÉER\n')
for (const [k, v] of Object.entries({ ...FICHE, profil_prenom: PROFIL.prenom, profil_telephone: PROFIL.telephone })) {
  console.log(`   ${k.padEnd(22)} ${v ?? '—'}`)
}
console.log(`\nFACTURE À RATTACHER\n   ${facture.numero}   ${facture.montant_ttc} €`)
console.log('\nE-mail envoyé à la cliente : AUCUN (compte créé déjà confirmé, mot de passe aléatoire non conservé)')

if (!ECRIRE) { console.log('\nSIMULATION — rien n’est écrit. Relancer avec « --ecrire ».\n'); process.exit(0) }

/* 1. le compte, silencieux */
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
/* Un compte peut déjà exister : la première tentative du 2026-10-16 l'a créé
 * avant d'échouer sur le profil. On le réutilise plutôt que d'en fabriquer un
 * second, qui laisserait un compte orphelin de plus. */
const rListe = await fetch(`${U}/auth/v1/admin/users?page=1&per_page=200`, { headers: H })
const liste = await rListe.json()
const deja = (liste.users ?? []).find((u: { email?: string }) => String(u.email).toLowerCase() === EMAIL.toLowerCase())

let user: { id: string }
if (deja) {
  user = deja
  console.log(`\n   compte déjà existant, réutilisé   ${user.id}`)
} else {
  const rUser = await fetch(`${U}/auth/v1/admin/users`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ email: EMAIL, password: randomBytes(24).toString('base64url'), email_confirm: true }),
  })
  user = await rUser.json()
  if (!rUser.ok || !user.id) { console.log(`ÉCHEC création du compte (${rUser.status}) ${JSON.stringify(user).slice(0, 200)}`); process.exit(1) }
  console.log(`\n   compte créé   ${user.id}`)
}

const trace: Record<string, unknown> = { user_id: user.id, facture_avant: facture }

/* 2. le profil */
const { error: eProfil } = await admin.from('profiles').upsert({ id: user.id, ...PROFIL })
if (eProfil) { console.log(`ÉCHEC profil : ${eProfil.message}`); process.exit(1) }
console.log('   profil créé')

/* 3. la fiche client */
const { error: eClient } = await admin.from('clients').insert({ id: user.id, user_id: user.id, ...FICHE })
if (eClient) { console.log(`ÉCHEC fiche client : ${eClient.message}`); process.exit(1) }
console.log('   fiche client créée')

/* 4. la facture */
const { error: eFacture } = await admin.from('factures').update({ client_id: user.id }).eq('id', facture.id)
if (eFacture) { console.log(`ÉCHEC rattachement : ${eFacture.message}`); process.exit(1) }
console.log('   facture rattachée')

writeFileSync(join(process.cwd(), '..', 'client-skorp-cree.json'), JSON.stringify(trace, null, 2))

/* Relecture depuis la base : on ne croit pas les réponses d'écriture. */
const { data: relu } = await admin
  .from('factures')
  .select('numero, montant_ttc, clients(type_compte, entreprise_nom, email, tel, adresse_facturation)')
  .eq('id', facture.id).single()
const c = (relu as any)?.clients
console.log('\nRELU EN BASE')
console.log(`   ${relu?.numero}  ${relu?.montant_ttc} €`)
console.log(`   ${c?.entreprise_nom ?? 'AUCUN CLIENT'}  ·  ${c?.email ?? ''}  ·  ${c?.tel ?? ''}`)
console.log(`   ${c?.adresse_facturation ?? ''}`)
console.log(c?.entreprise_nom === 'SKORP Production' ? '\nfait' : '\nÉCHEC — le rattachement ne se relit pas')
process.exitCode = c?.entreprise_nom === 'SKORP Production' ? 0 : 1
