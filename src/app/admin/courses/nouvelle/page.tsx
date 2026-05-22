import { createClient } from '@/lib/supabase/server'
import { TYPE_VEHICULE_LABEL } from '@/lib/types'
import { creerCourseAction } from './actions'
import ClientCollaborateurSelect from './ClientCollaborateurSelect'

export default async function NouvelleCourse({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams
  const supabase = await createClient()

  const [clientsRes, chauffeursRes, collabsRes, sousTraitantsRes] = await Promise.all([
    supabase.from('clients').select('id, entreprise_nom, type_compte, profiles(prenom, nom)'),
    supabase.from('chauffeurs').select('id, statut, vehicule_marque, vehicule_modele, profiles(prenom, nom)')
      .in('statut', ['disponible', 'hors_ligne']),
    supabase.from('collaborateurs').select('id, client_id, poste, profiles(prenom, nom)'),
    supabase.from('sous_traitants').select('id, nom').eq('actif', true).order('nom'),
  ])

  const clients = clientsRes.data ?? []
  const chauffeurs = chauffeursRes.data ?? []
  const collabs = collabsRes.data ?? []
  const sousTraitants = sousTraitantsRes.data ?? []

  // Default datetime = now + 1h, rounded to 15min
  const now = new Date()
  now.setHours(now.getHours() + 1, Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
  const defaultDatetime = now.toISOString().slice(0, 16)

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="/admin/courses" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Courses
        </a>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Nouvelle course</div>
      </div>

      <div style={{ padding: '32px', maxWidth: 700 }}>
        <form action={creerCourseAction}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Trajet */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{
                fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'var(--t2)', fontWeight: 500, marginBottom: 12,
              }}>Trajet</legend>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)',
                  }} />
                  <input
                    name="adresse_depart"
                    placeholder="Adresse de départ"
                    required
                    style={{ ...inputStyle, paddingLeft: 34 }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)',
                  }} />
                  <input
                    name="adresse_arrivee"
                    placeholder="Adresse d'arrivée"
                    required
                    style={{ ...inputStyle, paddingLeft: 34 }}
                  />
                </div>
              </div>
            </fieldset>

            {/* Date + Passagers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
              <div>
                <label style={labelStyle}>Date et heure prévue</label>
                <input
                  name="date_prevue"
                  type="datetime-local"
                  defaultValue={defaultDatetime}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Passagers</label>
                <input
                  name="nb_passagers"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={1}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Véhicule */}
            <div>
              <label style={labelStyle}>Type de véhicule</label>
              <select name="type_vehicule" required style={selectStyle}>
                {Object.entries(TYPE_VEHICULE_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Client + Collaborateur */}
            <ClientCollaborateurSelect clients={clients as any} collabs={collabs as any} />

            {/* Chauffeur / Sous-traitant */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Chauffeur</label>
                <select name="chauffeur_id" style={selectStyle}>
                  <option value="">— Non assigné —</option>
                  {chauffeurs.map((c: any) => {
                    const p = c.profiles
                    const nom = `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim()
                    const vehicule = `${c.vehicule_marque ?? ''} ${c.vehicule_modele ?? ''}`.trim()
                    const dispo = c.statut === 'disponible' ? ' ✓' : ''
                    return (
                      <option key={c.id} value={c.id}>
                        {nom}{vehicule ? ` — ${vehicule}` : ''}{dispo}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sous-traitant</label>
                <select name="sous_traitant_id" style={selectStyle}>
                  <option value="">— Aucun —</option>
                  {sousTraitants.map((st: any) => (
                    <option key={st.id} value={st.id}>{st.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prix estimé */}
            <div>
              <label style={labelStyle}>Prix estimé (€)</label>
              <input
                name="prix_estime"
                type="number"
                min={0}
                step={0.5}
                placeholder="Ex : 45.00"
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes internes</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Instructions particulières, références client, etc."
                style={{ ...inputStyle, resize: 'vertical', height: 'auto', paddingTop: 10, paddingBottom: 10 }}
              />
            </div>

            {/* Erreur */}
            {formError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)',
                color: 'var(--red)', fontSize: 12,
              }}>
                {formError}
              </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button type="submit" style={{
                padding: '13px 32px', borderRadius: 10,
                background: 'var(--gold)',
                border: 'none', color: 'var(--base)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                boxShadow: '0 4px 16px rgba(201,168,76,.3)',
              }}>
                Créer la course
              </button>
              <a href="/admin/courses" style={{
                padding: '13px 24px', borderRadius: 10,
                background: 'var(--elevated)',
                border: '1px solid var(--t3)', color: 'var(--t2)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textDecoration: 'none', display: 'flex', alignItems: 'center',
              }}>
                Annuler
              </a>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)',
  border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)',
  fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%23848499' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
  color: 'var(--t2)', fontWeight: 500, marginBottom: 7,
}
