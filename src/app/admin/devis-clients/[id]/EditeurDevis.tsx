'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formaterMontant } from '@/lib/montant'
import { calculerTotal, ligneVide, STATUTS, type DevisClient, type LigneDevis } from '@/lib/devis-client'
import { ANNULATION_MENTION, ATTENTE_MENTION } from '@/lib/conditions'
import {
  basculerCarteRequise, changerStatutDevis, convertirDevisEnCourses, encaisserDevisAction,
  enregistrerDevis, envoyerAcceptationAction, facturerDevisAction, libererDevisAction,
  supprimerDevisClient,
} from '../actions'

/* Les styles sont en ligne comme sur le reste de l'administration. Les
   largeurs de colonnes passent par une grille nommée, pour qu'un seul
   `@media` suffise à tout empiler sur téléphone. */
const champ: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit',
  background: 'var(--surface)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 8,
  color: 'var(--t1)', outline: 'none', boxSizing: 'border-box',
}
const etiquette: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'var(--t3)', marginBottom: 5, fontWeight: 600,
}
const carte: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(201,168,76,.12)',
  borderRadius: 12, padding: '20px 22px', marginBottom: 18,
}

export default function EditeurDevis({ devis }: { devis: DevisClient }) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  const [form, setForm] = useState({
    client_nom:      devis.client_nom ?? '',
    client_societe:  devis.client_societe ?? '',
    client_email:    devis.client_email ?? '',
    client_tel:      devis.client_tel ?? '',
    client_adresse:  devis.client_adresse ?? '',
    date_prestation: devis.date_prestation ?? '',
    date_validite:   devis.date_validite ?? '',
    notes:           devis.notes ?? '',
  })
  const [lignes, setLignes] = useState<LigneDevis[]>(
    devis.lignes.length ? devis.lignes : [ligneVide()])

  const total = useMemo(() => calculerTotal(lignes), [lignes])

  function majLigne(i: number, champName: keyof LigneDevis, valeur: string) {
    setLignes(l => l.map((ligne, k) => {
      if (k !== i) return ligne
      if (champName === 'prix')      return { ...ligne, prix: Number(valeur.replace(',', '.')) || 0 }
      if (champName === 'passagers') return { ...ligne, passagers: valeur === '' ? null : Number(valeur) }
      return { ...ligne, [champName]: valeur }
    }))
  }

  function deplacer(i: number, sens: -1 | 1) {
    const j = i + sens
    if (j < 0 || j >= lignes.length) return
    setLignes(l => { const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c })
  }

  /* Un seul endroit qui met le formulaire en forme pour la base : « Enregistrer »
     et « Envoyer » doivent écrire exactement la même chose. */
  function saisieCourante() {
    return { ...form, lignes,
      client_societe: form.client_societe || null,
      client_email:   form.client_email || null,
      client_tel:     form.client_tel || null,
      client_adresse: form.client_adresse || null,
      date_prestation: form.date_prestation || null,
      date_validite:   form.date_validite || null,
      notes:           form.notes || null,
    }
  }

  function enregistrer() {
    demarrer(async () => {
      setErreur(''); setMessage('')
      try {
        await enregistrerDevis(devis.id, saisieCourante())
        setMessage('Enregistré.')
        router.refresh()
      } catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.') }
    })
  }

  /**
   * L'écran d'envoi compose le message à partir de la BASE, pas du formulaire
   * ouvert ici. Un simple lien aurait donc fait partir la version précédente
   * dès qu'une correction n'était pas enregistrée — on enregistre d'abord.
   */
  function allerEnvoyer() {
    demarrer(async () => {
      setErreur(''); setMessage('')
      try {
        await enregistrerDevis(devis.id, saisieCourante())
        router.push(`/admin/devis-clients/${devis.id}/envoi`)
      } catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.') }
    })
  }

  return (
    <div style={{ padding: '24px 28px 70px', maxWidth: 1060 }}>
      <style>{`
        @media (max-width: 760px) {
          .dv-ligne   { grid-template-columns: 1fr !important; }
          .dv-duo     { grid-template-columns: 1fr !important; }
          .dv-entetes { display: none !important; }
          .dv-barre   { position: static !important; }
        }
        .dv-ligne input:focus { border-color: rgba(201,168,76,.65); box-shadow: 0 0 0 3px rgba(201,168,76,.12) }
        .dv-ico { background:none; border:1px solid rgba(201,168,76,.12); border-radius:7px; width:28px; height:28px;
                  cursor:pointer; color:var(--t3); font-size:13px; line-height:1 }
        .dv-ico:hover { border-color: rgba(201,168,76,.5); color:#C9A84C }
        .dv-ico:disabled { opacity:.3; cursor:default }
      `}</style>

      {/* ── En-tête ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <Link href="/admin/devis-clients" style={{ fontSize: 12.5, color: '#C9A84C', textDecoration: 'none' }}>← Tous les devis</Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 25, fontWeight: 500, color: 'var(--t1)', margin: '8px 0 2px' }}>
            {form.client_nom || 'Nouveau devis'}
          </h1>
          <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#C9A84C' }}>
            {devis.numero} · {STATUTS[devis.statut]}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link
            href={`/admin/devis-clients/${devis.id}/document`}
            style={{
              background: 'none', border: '1px solid rgba(201,168,76,.12)', color: 'var(--t1)',
              borderRadius: 9, padding: '10px 16px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Voir le document
          </Link>
          <button
            type="button" onClick={allerEnvoyer} disabled={enCours}
            style={{
              background: 'var(--gold)', color: '#0B0B14', border: 'none', borderRadius: 9,
              padding: '11px 18px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              cursor: enCours ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {enCours ? 'Enregistrement…' : 'Envoyer au client →'}
          </button>
        </div>
      </div>

      {/* ── FAIRE CONFIRMER LE CLIENT ────────────────────────────────

          Le devis envoyé, c'est au client de s'engager. Ce bouton lui
          adresse « nous avons accepté votre demande » avec un lien privé :
          il ouvre son devis, confirme, et laisse sa carte si elle est
          demandée. La carte est RETENUE, pas débitée — vous encaissez
          après avoir confirmé le véhicule.

          Le devis ne passe pas en « accepté » ici : c'est le clic du
          client qui le fait, et lui seul. */}
      {devis.statut !== 'brouillon' && !devis.accepte_le && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
          padding: '14px 16px', marginBottom: 16, borderRadius: 10,
          background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.12)',
        }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A22', marginBottom: 3 }}>
              Faire confirmer la réservation
            </div>
            <div style={{ fontSize: 11.5, color: '#6A6A58', lineHeight: 1.55 }}>
              {devis.carte_requise
                ? 'Le client confirmera en laissant sa carte — retenue, pas débitée.'
                : 'Le client confirmera d’un clic, sans carte.'}
            </div>
          </div>

          {/* La zone CLIQUABLE est l'étiquette entière, pas la case : au doigt,
              une case de 15 px se rate. `audit-admin-mobile.mjs` exige 44 px,
              d'où la hauteur minimale et la marge intérieure ici. */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap',
            minHeight: 44, padding: '0 10px 0 4px', borderRadius: 8,
          }}>
            <input
              type="checkbox"
              checked={!devis.carte_requise}
              disabled={enCours}
              onChange={e => demarrer(async () => {
                try { await basculerCarteRequise(devis.id, !e.target.checked); router.refresh() }
                catch (err) { setErreur(err instanceof Error ? err.message : 'Changement impossible.') }
              })}
              style={{ width: 18, height: 18, accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }}
            />
            Client de confiance — sans carte
          </label>

          <button type="button" disabled={enCours}
                  onClick={() => demarrer(async () => {
                    setErreur(''); setMessage('')
                    try {
                      const a = await envoyerAcceptationAction(devis.id)
                      setMessage(`Demande de confirmation envoyée à ${a}.`)
                      router.refresh()
                    } catch (err) { setErreur(err instanceof Error ? err.message : 'Envoi impossible.') }
                  })}
                  style={{ background: '#09091A', border: 'none', color: '#F8F6F1',
                           borderRadius: 9, padding: '11px 18px', fontSize: 13,
                           fontWeight: 600, cursor: enCours ? 'wait' : 'pointer',
                           fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Accepter et demander confirmation
          </button>
        </div>
      )}

      {/* ── LA RETENUE DE CARTE : ENCAISSER OU LIBÉRER ───────────────────

          Le client a confirmé et laissé sa carte. Stripe retient la somme
          sans la débiter, SEPT JOURS — après quoi il la rend tout seul, sans
          avertir personne. Deux boutons, une décision :

            Encaisser → la somme est prise, les courses passent « payé » ;
            Libérer   → rien n'est débité, les courses sont annulées.

          POURQUOI ICI, ET PAS SUR CHAQUE COURSE. Un devis porte plusieurs
          prestations et UNE SEULE retenue. Un index unique interdit qu'un
          même paiement Stripe appartienne à deux courses — c'est lui qui
          empêche un rejeu de Stripe de dédoubler le planning. La décision se
          prend donc une fois, sur le devis, pour toutes ses courses. */}
      {devis.accepte_le && devis.stripe_session_id && (
        <div style={{
          padding: '14px 16px', marginBottom: 16, borderRadius: 10,
          background: 'rgba(201,168,76,.10)', border: '1px solid rgba(201,168,76,.30)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A22', marginBottom: 4 }}>
            La carte du client est retenue
          </div>
          <div style={{ fontSize: 11.5, color: '#6A6A58', lineHeight: 1.6, marginBottom: 12 }}>
            Rien ne lui a été débité. Vérifiez que vous avez les véhicules à la
            date prévue, puis encaissez — ou libérez la retenue si vous ne
            pouvez pas assurer la prestation.
            <br />
            <span style={{ color: '#8A6A2A' }}>
              Stripe libère la somme tout seul au bout de 7 jours, sans prévenir.
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" disabled={enCours}
                    onClick={() => demarrer(async () => {
                      setErreur(''); setMessage('')
                      const r = await encaisserDevisAction(devis.id)
                      if (r.error) { setErreur(r.error); return }
                      /* `formaterMontant` et rien d'autre : `toFixed(2)` rend
                         l'écriture anglaise, et le corriger par une virgule
                         posée à la main serait une DEUXIÈME écriture de la
                         règle, à côté de la bonne (charte, 2026-10-15). */
                      setMessage(`Encaissé : ${formaterMontant(r.montant ?? 0)} · `
                        + `${r.coursesReglees ?? 0} course(s) passée(s) en « payé ».`)
                      router.refresh()
                    })}
                    style={{ background: 'var(--grn)', border: 'none', color: '#F8F6F1',
                             borderRadius: 9, padding: '11px 18px', fontSize: 13,
                             fontWeight: 600, cursor: enCours ? 'wait' : 'pointer',
                             fontFamily: 'inherit' }}>
              Encaisser la retenue
            </button>

            <button type="button" disabled={enCours}
                    onClick={() => demarrer(async () => {
                      setErreur(''); setMessage('')
                      const r = await libererDevisAction(devis.id)
                      if (r.error) { setErreur(r.error); return }
                      setMessage(`Retenue levée · ${r.coursesLiberees ?? 0} course(s) `
                        + `annulée(s). Le client n'a rien payé.`)
                      router.refresh()
                    })}
                    style={{ background: 'transparent', border: '1px solid rgba(201,168,76,.12)',
                             color: 'var(--t2)', borderRadius: 9, padding: '11px 18px',
                             fontSize: 13, fontWeight: 500,
                             cursor: enCours ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              Libérer la retenue
            </button>
          </div>
        </div>
      )}

      {/* Où en est ce devis — voir le composant en bas de fichier. */}
      <Progression devis={devis} />

      {/* ── Client ─────────────────────────────────────────── */}
      <div style={carte}>
        <div style={{ ...etiquette, marginBottom: 14 }}>Client</div>
        <div className="dv-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={etiquette} htmlFor="dv-nom">Nom et prénom *</label>
            <input id="dv-nom" style={champ} value={form.client_nom}
                   onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))} placeholder="Hanaë Giaoui" />
          </div>
          <div>
            <label style={etiquette} htmlFor="dv-soc">Société (facultatif)</label>
            <input id="dv-soc" style={champ} value={form.client_societe}
                   onChange={e => setForm(f => ({ ...f, client_societe: e.target.value }))} placeholder="Laisser vide si inconnue" />
          </div>
          <div>
            <label style={etiquette} htmlFor="dv-mail">E-mail</label>
            <input id="dv-mail" type="email" style={champ} value={form.client_email}
                   onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
          </div>
          <div>
            <label style={etiquette} htmlFor="dv-tel">Téléphone</label>
            <input id="dv-tel" type="tel" style={champ} value={form.client_tel}
                   onChange={e => setForm(f => ({ ...f, client_tel: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={etiquette} htmlFor="dv-adr">Adresse</label>
          <input id="dv-adr" style={champ} value={form.client_adresse}
                 onChange={e => setForm(f => ({ ...f, client_adresse: e.target.value }))}
                 placeholder="18 rue du vieux lavoir, 95470 Saint-Witz" />
          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 5 }}>
            Séparez les lignes par des virgules : le document les met l&apos;une sous l&apos;autre.
          </div>
        </div>
        <div style={{
          marginTop: 14, fontSize: 12, color: 'var(--t3)', background: 'rgba(201,168,76,.12)',
          border: '1px solid rgba(201,168,76,.12)', borderRadius: 8, padding: '10px 13px',
        }}>
          {form.client_societe.trim()
            ? <>Société renseignée : le devis portera les mentions de <b>retard de paiement entre professionnels</b> (art. L441-10).</>
            : <>Pas de société : le devis est traité comme adressé à un <b>particulier</b>, sans les mentions de recouvrement entre professionnels.</>}
        </div>
      </div>

      {/* ── Dates ──────────────────────────────────────────── */}
      <div style={carte}>
        <div style={{ ...etiquette, marginBottom: 14 }}>Dates</div>
        <div className="dv-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={etiquette} htmlFor="dv-dp">Jour des prestations</label>
            <input id="dv-dp" type="date" style={champ} value={form.date_prestation}
                   onChange={e => setForm(f => ({ ...f, date_prestation: e.target.value }))} />
          </div>
          <div>
            <label style={etiquette} htmlFor="dv-dv">Devis valable jusqu&apos;au</label>
            <input id="dv-dv" type="date" style={champ} value={form.date_validite}
                   onChange={e => setForm(f => ({ ...f, date_validite: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* ── Prestations ────────────────────────────────────── */}
      <div style={carte}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={etiquette}>Prestations</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</div>
        </div>

        <div className="dv-entetes" style={{
          display: 'grid', gridTemplateColumns: '78px 1fr 1fr 130px 60px 92px 64px',
          gap: 9, marginBottom: 7,
        }}>
          {['Heure', 'Départ', 'Arrivée', 'Véhicule', 'Pax', 'Prix €', ''].map((t, i) => (
            <span key={i} style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 600 }}>{t}</span>
          ))}
        </div>

        {lignes.map((l, i) => (
          <div key={i} className="dv-ligne" style={{
            display: 'grid', gridTemplateColumns: '78px 1fr 1fr 130px 60px 92px 64px',
            gap: 9, marginBottom: 9, alignItems: 'center',
          }}>
            <input style={champ} value={l.heure} placeholder="10h15" aria-label={`Heure, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'heure', e.target.value)} />
            <input style={champ} value={l.depart} placeholder="Adresse de départ" aria-label={`Départ, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'depart', e.target.value)} />
            <input style={champ} value={l.arrivee} placeholder="Adresse d'arrivée" aria-label={`Arrivée, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'arrivee', e.target.value)} />
            <input style={champ} value={l.vehicule} placeholder="1 van" aria-label={`Véhicule, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'vehicule', e.target.value)} />
            <input style={{ ...champ, textAlign: 'center' }} value={l.passagers ?? ''} inputMode="numeric"
                   aria-label={`Passagers, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'passagers', e.target.value)} />
            <input style={{ ...champ, textAlign: 'right', fontFamily: 'monospace' }} value={l.prix || ''} inputMode="decimal"
                   aria-label={`Prix, ligne ${i + 1}`}
                   onChange={e => majLigne(i, 'prix', e.target.value)} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="dv-ico" title="Monter" disabled={i === 0}
                      onClick={() => deplacer(i, -1)} aria-label={`Monter la ligne ${i + 1}`}>↑</button>
              <button type="button" className="dv-ico" title="Supprimer"
                      onClick={() => setLignes(ls => ls.length > 1 ? ls.filter((_, k) => k !== i) : [ligneVide()])}
                      aria-label={`Supprimer la ligne ${i + 1}`}>×</button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setLignes(l => [...l, ligneVide()])}
                  style={{ background: 'rgba(201,168,76,.10)', border: '1px solid rgba(201,168,76,.32)',
                           color: 'var(--gold)', borderRadius: 8, padding: '9px 16px', fontSize: 13,
                           fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Ajouter une prestation
          </button>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            Total&nbsp;
            <b style={{ fontFamily: 'monospace', fontSize: 18, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
              {formaterMontant(total)}
            </b>
          </div>
        </div>
      </div>

      {/* ── Conditions, pour mémoire ────────────────────────── */}
      {/* Il y avait ici deux champs — minutes offertes, tarif horaire — qui
          fixaient la clause d'attente devis par devis. Ils portaient 70 €/h,
          un chiffre inventé : le cahier des charges dit 15 minutes offertes
          puis 0,50 € la minute. Depuis le 2026-11-03 la règle est unique et
          vit dans `conditions.ts`. Les champs sont retirés plutôt que laissés
          sans effet — un formulaire qui n'agit sur rien est pire qu'un
          formulaire absent. */}
      <div style={{ ...carte, background: 'rgba(201,168,76,.12)' }}>
        <div style={{ ...etiquette, marginBottom: 10 }}>Conditions, identiques sur tous les devis</div>
        <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.75 }}>
          {ANNULATION_MENTION}<br />
          {ATTENTE_MENTION}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 10, lineHeight: 1.6 }}>
          Elles figurent en bas du devis, en petits caractères. Pour les changer,
          il faut modifier la règle du projet — elles doivent rester identiques
          partout : site, devis, fiche Google.
        </div>
      </div>

      {/* ── Barre d'actions ────────────────────────────────── */}
      <div className="dv-barre" style={{
        position: 'sticky', bottom: 0, background: 'rgba(248,246,241,.96)',
        backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(201,168,76,.12)',
        padding: '14px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <button type="button" onClick={enregistrer} disabled={enCours}
                style={{ background: '#C9A84C', color: 'var(--t1)', border: 'none', borderRadius: 9,
                         padding: '12px 22px', fontSize: 13.5, fontWeight: 700,
                         cursor: enCours ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <select
          value={devis.statut}
          aria-label="Statut du devis"
          onChange={e => demarrer(async () => {
            setErreur('')
            try { await changerStatutDevis(devis.id, e.target.value); router.refresh() }
            catch (err) { setErreur(err instanceof Error ? err.message : 'Changement impossible.') }
          })}
          style={{ ...champ, width: 'auto', padding: '11px 13px', cursor: 'pointer' }}
        >
          {Object.entries(STATUTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* LE DEVIS DEVIENT UNE FACTURE.

            Demandé par l'exploitant le 2026-11-09 : « transformer ce devis
            en facture et en réservation en même temps ». Le bouton
            n'apparaît qu'une fois le devis accepté — facturer un devis que
            le client n'a pas validé n'a pas de sens, et l'ordre
            « prestation puis facture » est celui que l'exploitant décrit
            lui-même.

            Il exige un client enregistré : c'est `factures.client_id` qui
            rattache une facture à quelqu'un. L'action le dit en toutes
            lettres quand il manque, plutôt que d'échouer en silence. */}
        {devis.statut === 'accepte' && (
          <button type="button" disabled={enCours}
                  onClick={() => demarrer(async () => {
                    setErreur(''); setMessage('')
                    try {
                      const r = await facturerDevisAction(devis.id)
                      if ('clientManquant' in r) {
                        setMessage(`Aucune fiche client pour ${devis.client_email} — on la crée d’abord.`)
                        router.push(r.clientManquant)
                        return
                      }
                      router.push(`/admin/facturation/${r.factureId}`)
                    } catch (err) { setErreur(err instanceof Error ? err.message : 'Facturation impossible.') }
                  })}
                  style={{ background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.35)',
                           color: 'var(--gold)', borderRadius: 9, padding: '12px 18px', fontSize: 13,
                           fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Créer la facture
          </button>
        )}
        {devis.statut !== 'accepte' && (
          <button type="button" disabled={enCours}
                  onClick={() => demarrer(async () => {
                    setErreur(''); setMessage('')
                    try {
                      const n = await convertirDevisEnCourses(devis.id)
                      setMessage(`${n} course${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''}.`)
                      router.refresh()
                    } catch (err) { setErreur(err instanceof Error ? err.message : 'Conversion impossible.') }
                  })}
                  style={{ background: 'rgba(61,184,122,.12)', border: '1px solid rgba(61,184,122,.35)',
                           color: 'var(--grn)', borderRadius: 9, padding: '12px 18px', fontSize: 13,
                           fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Accepté → créer les courses
          </button>
        )}

        <button type="button" disabled={enCours}
                onClick={() => demarrer(async () => {
                  if (!confirmerSuppression()) return
                  try { await supprimerDevisClient(devis.id); router.push('/admin/devis-clients') }
                  catch (err) { setErreur(err instanceof Error ? err.message : 'Suppression impossible.') }
                })}
                style={{ background: 'none', border: '1px solid rgba(217,84,84,.3)', color: 'var(--red-txt)',
                         borderRadius: 9, padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                         fontFamily: 'inherit', marginLeft: 'auto' }}>
          Supprimer
        </button>

        {message && <span style={{ fontSize: 13, color: 'var(--grn)', width: '100%' }}>{message}</span>}
        {erreur && <span style={{ fontSize: 13, color: 'var(--red-txt)', width: '100%' }}>{erreur}</span>}
      </div>
    </div>
  )
}

/* `confirm()` est inerte dans certains contextes ; on garde une porte de
   sortie explicite plutôt qu'une suppression silencieuse. */
function confirmerSuppression(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.confirm('Supprimer définitivement ce devis ?') } catch { return false }
}

/**
 * Où en est ce devis, en une ligne.
 *
 * L'exploitant ne pouvait pas savoir si un devis était réellement parti,
 * ni depuis combien de temps il attendait une réponse. Le statut seul ne
 * le disait pas : « envoyé » se pose aussi bien par le bouton d'envoi que
 * par la liste déroulante.
 *
 * Les devis d'avant le 2026-11-11 n'ont pas de date d'envoi : on écrit
 * alors « marqué envoyé » plutôt que d'inventer une date.
 */
function Progression({ devis }: { devis: DevisClient }) {
  const fmt = (v: string | null) => v
    ? new Date(v).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const jours = devis.envoye_le
    ? Math.floor((Date.now() - new Date(devis.envoye_le).getTime()) / 86_400_000)
    : null

  const etapes: { fait: boolean; texte: string }[] = [
    { fait: true, texte: `Créé le ${fmt(devis.created_at)}` },
    devis.envoye_le
      ? {
          fait: true,
          texte: `Envoyé le ${fmt(devis.envoye_le)}`
            + (devis.envoye_a ? ` à ${devis.envoye_a}` : ''),
        }
      : { fait: devis.statut !== 'brouillon', texte: devis.statut === 'brouillon'
          ? 'Pas encore envoyé'
          : 'Marqué envoyé — aucune date enregistrée' },
    devis.accepte_le
      ? { fait: true, texte: `Accepté le ${fmt(devis.accepte_le)}` }
      : { fait: devis.statut === 'accepte',
          texte: devis.statut === 'accepte'
            ? 'Accepté'
            : jours === null
              ? 'En attente de réponse'
              : `En attente depuis ${jours} jour${jours > 1 ? 's' : ''}` },
  ]

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      padding: '10px 14px', marginBottom: 16, borderRadius: 9,
      background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.18)',
      fontSize: 12, color: 'var(--t2)',
    }}>
      {etapes.map((e, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {i > 0 && <span style={{ color: '#C9A84C', opacity: .5 }}>→</span>}
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: e.fait ? 'var(--grn)' : 'rgba(201,168,76,.12)',
            display: 'inline-block', flex: 'none',
          }} />
          <span style={{ color: e.fait ? '#3A3A30' : '#8A8A7A' }}>{e.texte}</span>
        </span>
      ))}
    </div>
  )
}
