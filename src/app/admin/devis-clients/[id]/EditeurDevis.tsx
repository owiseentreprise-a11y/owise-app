'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formaterMontant } from '@/lib/montant'
import { calculerTotal, ligneVide, STATUTS, type DevisClient, type LigneDevis } from '@/lib/devis-client'
import { ANNULATION_MENTION, ATTENTE_MENTION } from '@/lib/conditions'
import { changerStatutDevis, convertirDevisEnCourses, enregistrerDevis, supprimerDevisClient } from '../actions'

/* Les styles sont en ligne comme sur le reste de l'administration. Les
   largeurs de colonnes passent par une grille nommée, pour qu'un seul
   `@media` suffise à tout empiler sur téléphone. */
const champ: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit',
  background: '#FFFFFF', border: '1px solid rgba(0,0,0,.14)', borderRadius: 8,
  color: '#0A0A0A', outline: 'none', boxSizing: 'border-box',
}
const etiquette: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
  color: '#999', marginBottom: 5, fontWeight: 600,
}
const carte: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid rgba(0,0,0,.07)',
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
        .dv-ico { background:none; border:1px solid rgba(0,0,0,.12); border-radius:7px; width:28px; height:28px;
                  cursor:pointer; color:#777; font-size:13px; line-height:1 }
        .dv-ico:hover { border-color: rgba(201,168,76,.5); color:#C9A84C }
        .dv-ico:disabled { opacity:.3; cursor:default }
      `}</style>

      {/* ── En-tête ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <Link href="/admin/devis-clients" style={{ fontSize: 12.5, color: '#C9A84C', textDecoration: 'none' }}>← Tous les devis</Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 25, fontWeight: 500, color: '#0A0A0A', margin: '8px 0 2px' }}>
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
              background: 'none', border: '1px solid rgba(0,0,0,.18)', color: '#0A0A0A',
              borderRadius: 9, padding: '10px 16px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Voir le document
          </Link>
          <button
            type="button" onClick={allerEnvoyer} disabled={enCours}
            style={{
              background: '#0A0A0A', color: '#F8F6F1', border: 'none', borderRadius: 9,
              padding: '11px 18px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              cursor: enCours ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {enCours ? 'Enregistrement…' : 'Envoyer au client →'}
          </button>
        </div>
      </div>

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
          <div style={{ fontSize: 11.5, color: '#999', marginTop: 5 }}>
            Séparez les lignes par des virgules : le document les met l&apos;une sous l&apos;autre.
          </div>
        </div>
        <div style={{
          marginTop: 14, fontSize: 12, color: '#777', background: 'rgba(0,0,0,.025)',
          border: '1px solid rgba(0,0,0,.06)', borderRadius: 8, padding: '10px 13px',
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
          <div style={{ fontSize: 12, color: '#999' }}>{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</div>
        </div>

        <div className="dv-entetes" style={{
          display: 'grid', gridTemplateColumns: '78px 1fr 1fr 130px 60px 92px 64px',
          gap: 9, marginBottom: 7,
        }}>
          {['Heure', 'Départ', 'Arrivée', 'Véhicule', 'Pax', 'Prix €', ''].map((t, i) => (
            <span key={i} style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600 }}>{t}</span>
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
                           color: '#9A7E2E', borderRadius: 8, padding: '9px 16px', fontSize: 13,
                           fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Ajouter une prestation
          </button>
          <div style={{ fontSize: 13, color: '#777' }}>
            Total&nbsp;
            <b style={{ fontFamily: 'monospace', fontSize: 18, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums' }}>
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
      <div style={{ ...carte, background: 'rgba(0,0,0,.02)' }}>
        <div style={{ ...etiquette, marginBottom: 10 }}>Conditions, identiques sur tous les devis</div>
        <div style={{ fontSize: 12.5, color: '#666', lineHeight: 1.75 }}>
          {ANNULATION_MENTION}<br />
          {ATTENTE_MENTION}
        </div>
        <div style={{ fontSize: 11.5, color: '#999', marginTop: 10, lineHeight: 1.6 }}>
          Elles figurent en bas du devis, en petits caractères. Pour les changer,
          il faut modifier la règle du projet — elles doivent rester identiques
          partout : site, devis, fiche Google.
        </div>
      </div>

      {/* ── Barre d'actions ────────────────────────────────── */}
      <div className="dv-barre" style={{
        position: 'sticky', bottom: 0, background: 'rgba(248,246,241,.96)',
        backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(0,0,0,.08)',
        padding: '14px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <button type="button" onClick={enregistrer} disabled={enCours}
                style={{ background: '#C9A84C', color: '#0A0A0A', border: 'none', borderRadius: 9,
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
                           color: '#2E8A58', borderRadius: 9, padding: '12px 18px', fontSize: 13,
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
                style={{ background: 'none', border: '1px solid rgba(217,84,84,.3)', color: '#B14343',
                         borderRadius: 9, padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                         fontFamily: 'inherit', marginLeft: 'auto' }}>
          Supprimer
        </button>

        {message && <span style={{ fontSize: 13, color: '#2E8A58', width: '100%' }}>{message}</span>}
        {erreur && <span style={{ fontSize: 13, color: '#D95454', width: '100%' }}>{erreur}</span>}
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
