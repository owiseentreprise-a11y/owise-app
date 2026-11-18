import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import NouvelleFactureForm from './NouvelleFactureForm'

export const dynamic = 'force-dynamic'

/* Le moyen de paiement d'une course, dans le vocabulaire du formulaire de
   facture. Les courses écrivent « cash » ; le formulaire propose « especes ».
   Une valeur inconnue n'est pas devinée : le champ reste à choisir. */
const MODE_COURSE_VERS_FACTURE: Record<string, string> = {
  tpe_bord: 'tpe_bord', cash: 'especes', especes: 'especes',
  virement: 'virement', cheque: 'cheque', stripe: 'stripe',
}

export default async function NouvelleFacturePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; error?: string }>
}) {
  const { course: courseDemandee, error: erreur } = await searchParams
  const supabase = createAdminClient()

  const [clientsRes, coursesRes, parametresRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, type_compte, entreprise_nom, profiles(prenom, nom)')
      .order('entreprise_nom'),
    supabase
      .from('courses')
      .select('id, client_id, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime')
      .eq('statut', 'terminee')
      .is('facture_id', null)
      .or('prix_final.not.is.null,prix_estime.not.is.null')
      .order('date_prevue'),
    supabase.from('parametres').select('facture_taux_tva, facture_delai_paiement').eq('id', true).single(),
  ])

  const clients = clientsRes.data ?? []
  const courses = coursesRes.data ?? []
  const tauxTva = parametresRes.data?.facture_taux_tva ?? 0
  const delaiPaiement = parametresRes.data?.facture_delai_paiement ?? 30

  /* ── Arrivée depuis la page d'une course (« Créer la facture ») ──
     On ne pré-remplit QUE ce que la base dit : la course doit figurer parmi
     les courses facturables ci-dessus (terminée, sans facture), et
     « déjà réglée » n'est cochée que si la course est marquée payée. */
  let initial: { clientId: string; courseId: string; dejaReglee: boolean; modePaiement: string } | null = null
  if (courseDemandee && courses.some(c => c.id === courseDemandee)) {
    const { data: c } = await supabase
      .from('courses')
      .select('id, client_id, paiement_statut, mode_paiement')
      .eq('id', courseDemandee)
      .single()
    if (c) {
      const payee = c.paiement_statut === 'paye'
      initial = {
        clientId: c.client_id ?? '',
        courseId: c.id,
        dejaReglee: payee,
        modePaiement: payee ? (MODE_COURSE_VERS_FACTURE[c.mode_paiement ?? ''] ?? '') : '',
      }
    }
  }

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/admin/facturation" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Facturation
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Nouvelle facture</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 800 }}>
        {/* L'action de création renvoie ici avec `?error=…` quand elle refuse.
            Ce message n'était jamais affiché : le formulaire se rechargeait,
            vide, sans un mot — « ça ne marchait pas » (exploitant, 2026-11-19). */}
        {erreur && (
          <div role="alert" style={{
            marginBottom: 20, padding: '14px 16px', borderRadius: 10,
            background: 'rgba(217,84,84,.1)', border: '1px solid rgba(217,84,84,.4)',
            color: 'var(--t1)', fontSize: 13, lineHeight: 1.5,
          }}>
            <strong style={{ color: '#E07070' }}>La facture n&apos;a pas été créée.</strong>{' '}
            {erreur}
          </div>
        )}
        {courseDemandee && !initial && (
          <div role="status" style={{
            marginBottom: 20, padding: '14px 16px', borderRadius: 10,
            background: 'rgba(232,160,48,.08)', border: '1px solid rgba(232,160,48,.35)',
            color: 'var(--t1)', fontSize: 13, lineHeight: 1.5,
          }}>
            Cette course ne peut pas être facturée ici : elle n&apos;est pas terminée, n&apos;a pas de prix, ou a déjà une facture.
          </div>
        )}
        <NouvelleFactureForm
          initial={initial}
          clients={clients as any}
          courses={courses as any}
          tauxTva={Number(tauxTva)}
          delaiPaiement={Number(delaiPaiement)}
        />
      </div>
    </>
  )
}
