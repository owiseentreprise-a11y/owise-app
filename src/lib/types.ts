// Types générés manuellement depuis le schéma Supabase

export type RoleUtilisateur = 'admin' | 'client' | 'chauffeur'
export type StatutCourse = 'en_attente' | 'acceptee' | 'en_route' | 'prise_en_charge' | 'terminee' | 'annulee'
export type TypeVehicule = 'berline' | 'berline_premium' | 'van_7' | 'grand_van_8'
export type StatutChauffeur = 'disponible' | 'en_course' | 'hors_ligne'
export type TypeContrat = 'salarie' | 'sous_traitant'
export type StatutFacture = 'en_attente' | 'payee' | 'retard'
export type TypeDocument = 'carte_vtc' | 'assurance_rc' | 'visite_medicale' | 'permis'
export type StatutDocument = 'valide' | 'bientot_expire' | 'expire'

// ─── Plain DB rows (no joins) — used in Database type ───────────────────────

export interface ProfileRow {
  id: string
  role: RoleUtilisateur
  nom: string
  prenom: string
  telephone: string | null
  created_at: string
}

export interface ChauffeurRow {
  id: string
  statut: StatutChauffeur
  type_contrat: TypeContrat
  note_moyenne: number
  nb_courses: number
  vehicule_marque: string | null
  vehicule_modele: string | null
  vehicule_immatriculation: string | null
  type_vehicule: TypeVehicule
  created_at: string
}

export interface ClientRow {
  id: string
  type_compte: string
  entreprise_nom: string | null
  adresse_facturation: string | null
  created_at: string
}

export interface SousTraitantRow {
  id: string
  nom: string
  contact_nom: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  siret: string | null
  notes: string | null
  actif: boolean
  created_at: string
}

export type SousTraitant = SousTraitantRow

export interface CourseRow {
  id: string
  client_id: string | null
  chauffeur_id: string | null
  sous_traitant_id: string | null
  statut: StatutCourse
  adresse_depart: string
  adresse_arrivee: string
  date_prevue: string
  date_debut: string | null
  date_fin: string | null
  prix_estime: number | null
  prix_final: number | null
  type_vehicule: TypeVehicule
  nb_passagers: number
  notes: string | null
  created_at: string
}

export interface FactureRow {
  id: string
  client_id: string | null
  numero: string
  statut: StatutFacture
  montant_ht: number
  montant_tva: number | null
  montant_ttc: number
  date_emission: string
  date_echeance: string | null
  stripe_payment_link: string | null
  created_at: string
}

export interface DocumentChauffeurRow {
  id: string
  chauffeur_id: string
  type: TypeDocument
  date_expiration: string
  statut: StatutDocument
  created_at: string
}

// ─── With joins — used in queries with .select('*, relation(*)') ─────────────

export type Profile = ProfileRow

export type Chauffeur = ChauffeurRow & {
  profiles?: ProfileRow
}

export type Client = ClientRow & {
  profiles?: ProfileRow
}

export type Course = CourseRow & {
  clients?: ClientRow & { profiles: ProfileRow }
  chauffeurs?: ChauffeurRow & { profiles: ProfileRow }
}

export type Facture = FactureRow & {
  clients?: ClientRow & { profiles: ProfileRow }
}

export type DocumentChauffeur = DocumentChauffeurRow

// ─── Database type for Supabase client ──────────────────────────────────────

// supabase-js v2 requires Relationships in every table entry
type Rel = never[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'created_at'>
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
      chauffeurs: {
        Row: ChauffeurRow
        Insert: Omit<ChauffeurRow, 'created_at'>
        Update: Partial<Omit<ChauffeurRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
      clients: {
        Row: ClientRow
        Insert: Omit<ClientRow, 'created_at'>
        Update: Partial<Omit<ClientRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
      courses: {
        Row: CourseRow
        Insert: Omit<CourseRow, 'id' | 'created_at'>
        Update: Partial<Omit<CourseRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
      factures: {
        Row: FactureRow
        Insert: Omit<FactureRow, 'id' | 'created_at'>
        Update: Partial<Omit<FactureRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
      documents_chauffeur: {
        Row: DocumentChauffeurRow
        Insert: Omit<DocumentChauffeurRow, 'id' | 'created_at'>
        Update: Partial<Omit<DocumentChauffeurRow, 'id' | 'created_at'>>
        Relationships: Rel
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const STATUT_COURSE_LABEL: Record<StatutCourse, string> = {
  en_attente:      'En attente',
  acceptee:        'Acceptée',
  en_route:        'En route',
  prise_en_charge: 'Client à bord',
  terminee:        'Terminée',
  annulee:         'Annulée',
}

export const STATUT_COURSE_COLOR: Record<StatutCourse, string> = {
  en_attente:      'var(--amb)',
  acceptee:        'var(--blu)',
  en_route:        'var(--blu)',
  prise_en_charge: 'var(--grn)',
  terminee:        'var(--t2)',
  annulee:         'var(--red)',
}

export const STATUT_CHAUFFEUR_COLOR: Record<StatutChauffeur, string> = {
  disponible:  'var(--grn)',
  en_course:   'var(--blu)',
  hors_ligne:  'var(--t3)',
}

export const TYPE_VEHICULE_LABEL: Record<TypeVehicule, string> = {
  berline:         'Berline',
  berline_premium: 'Berline Premium',
  van_7:           'Van 7 places',
  grand_van_8:     'Grand Van 8 pl.',
}
