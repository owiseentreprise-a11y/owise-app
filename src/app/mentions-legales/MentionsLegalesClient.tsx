'use client'

import { useState } from 'react'

const TABS = [
  { id: 'mentions',       label: 'Mentions légales' },
  { id: 'cgu',            label: 'CGU' },
  { id: 'cgv',            label: 'CGV' },
  { id: 'confidentialite',label: 'Confidentialité' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontFamily: 'var(--font-cormorant, Georgia), serif',
        fontSize: 20, fontWeight: 500, color: '#09091A',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        paddingBottom: 10, marginBottom: 14,
      }}>{title}</h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 12 }}>{children}</p>
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 4 }}>{item}</li>
      ))}
    </ul>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)',
      borderRadius: 8, padding: '12px 16px', marginBottom: 24,
      fontSize: 13, color: '#555', lineHeight: 1.7,
    }}>{children}</div>
  )
}

function DefTable({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 10, overflow: 'hidden', marginBottom: 16,
    }}>
      {rows.map(([term, desc], i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '180px 1fr',
          borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
        }}>
          <div style={{
            padding: '10px 14px', fontSize: 12,
            fontFamily: 'var(--font-jetbrains, monospace)',
            color: '#C9A84C', background: '#F8F6F1',
            borderRight: '1px solid rgba(0,0,0,.06)',
          }}>{term}</div>
          <div style={{ padding: '10px 14px', fontSize: 13, color: '#555' }}>{desc}</div>
        </div>
      ))}
    </div>
  )
}

function EM({ href, children, target }: { href: string; children: React.ReactNode; target?: string }) {
  return (
    <a href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      style={{ color: '#C9A84C', textDecoration: 'none', borderBottom: '1px solid rgba(201,168,76,.3)' }}>
      {children}
    </a>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#09091A', fontWeight: 500 }}>{children}</strong>
}

export default function MentionsLegalesClient() {
  const [active, setActive] = useState('mentions')

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F6F1',
      fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
    }}>

      {/* Header */}
      <div style={{
        background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/brand_assets/logo.svg" alt="Owise" style={{ height: 28 }} />
          <span style={{
            fontFamily: 'var(--font-cormorant, Georgia), serif',
            fontSize: 19, fontWeight: 600, letterSpacing: '.1em', color: '#09091A',
          }}>OWISE</span>
        </a>
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#6B6B6B', textDecoration: 'none',
          padding: '6px 12px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 6,
        }}>
          ← Retour
        </a>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 24px 32px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#C9A84C', fontWeight: 500, marginBottom: 10 }}>
          Informations légales
        </div>
        <h1 style={{
          fontFamily: 'var(--font-cormorant, Georgia), serif',
          fontSize: 32, fontWeight: 500, color: '#09091A', marginBottom: 8,
        }}>
          Documents légaux
        </h1>
        <p style={{ fontSize: 13, color: '#9B9B9B' }}>
          Mentions légales · Conditions générales · Politique de confidentialité
        </p>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,.08)', borderRadius: 10,
          overflow: 'hidden', marginBottom: 32,
        }}>
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                flex: 1, padding: '10px 8px',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'center',
                border: 'none',
                borderRight: i < TABS.length - 1 ? '1px solid rgba(0,0,0,.08)' : 'none',
                background: active === tab.id ? 'rgba(201,168,76,.08)' : 'transparent',
                color: active === tab.id ? '#C9A84C' : '#6B6B6B',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Mentions légales ── */}
        {active === 'mentions' && (
          <div>
            <Section title="Éditeur du site">
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,.08)',
                borderRadius: 10, padding: '18px 20px', marginBottom: 4,
              }}>
                {[
                  ['Dénomination sociale', 'Owise SAS'],
                  ['Forme juridique', 'Société par actions simplifiée'],
                  ['Capital social', '10 000 €'],
                  ['SIREN', 'En cours d\'immatriculation'],
                  ['Siège social', 'Paris, Île-de-France'],
                  ['Contact', 'owise.entreprise@gmail.com'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9B9B9B', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#09091A' }}>{value}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Hébergement">
              <P>Le site <Strong>owise.fr</Strong> est hébergé par :</P>
              <DefTable rows={[
                ['Hébergeur', 'Vercel Inc.'],
                ['Adresse', '340 Pine Street, Suite 1401, San Francisco, CA 94104, États-Unis'],
                ['Site', 'vercel.com'],
              ]} />
            </Section>

            <Section title="Activité réglementée">
              <P>Owise est une plateforme de mise en relation entre des clients particuliers ou entreprises et des chauffeurs VTC ou taxis conventionnels dûment habilités. Chaque chauffeur partenaire est titulaire d&apos;une carte professionnelle VTC délivrée par la préfecture compétente ou d&apos;une licence de taxi.</P>
              <P>Owise n&apos;effectue pas elle-même les transports : elle agit en qualité d&apos;intermédiaire au sens de l&apos;article L. 3120-1 et suivants du Code des transports.</P>
            </Section>

            <Section title="Propriété intellectuelle">
              <P>L&apos;ensemble des contenus présents sur le site owise.fr (textes, visuels, logo, interface, code source) est la propriété exclusive d&apos;Owise SAS ou de ses partenaires, et est protégé par le droit de la propriété intellectuelle français et international.</P>
            </Section>

            <Section title="Responsabilité">
              <P>Owise s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur son site. Owise ne saurait être tenue responsable de tout dommage direct ou indirect résultant de l&apos;accès au site ou de son utilisation.</P>
            </Section>

            <Section title="Médiation de la consommation">
              <P>Conformément à l&apos;article L. 616-1 du Code de la consommation, Owise propose à ses clients consommateurs un dispositif de médiation de la consommation. Contact : <EM href="mailto:mediation@owise.fr">mediation@owise.fr</EM>.</P>
            </Section>

            <Section title="Droit applicable">
              <P>Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.</P>
            </Section>
          </div>
        )}

        {/* ── CGU ── */}
        {active === 'cgu' && (
          <div>
            <InfoBox>En accédant et en utilisant la plateforme Owise, vous acceptez sans réserve les présentes Conditions Générales d&apos;Utilisation.</InfoBox>

            <Section title="1 — Objet">
              <P>Les présentes Conditions Générales d&apos;Utilisation (CGU) définissent les modalités et conditions dans lesquelles Owise SAS met à disposition ses services de mise en relation entre des utilisateurs et des prestataires de transport.</P>
            </Section>

            <Section title="2 — Accès à la plateforme">
              <P>L&apos;accès à la plateforme Owise est conditionné à la création d&apos;un compte utilisateur. L&apos;utilisateur doit :</P>
              <UL items={[
                'Être âgé d\'au moins 18 ans',
                'Fournir des informations exactes et complètes lors de l\'inscription',
                'Maintenir la confidentialité de ses identifiants de connexion',
                'Notifier immédiatement Owise de toute utilisation non autorisée de son compte',
              ]} />
            </Section>

            <Section title="3 — Services proposés">
              <UL items={[
                'Réserver une course auprès d\'un chauffeur partenaire',
                'Suivre en temps réel le trajet en cours',
                'Effectuer le paiement de manière sécurisée en ligne',
                'Consulter l\'historique de leurs courses et factures',
                'Évaluer la qualité du service après chaque course',
              ]} />
            </Section>

            <Section title="4 — Obligations de l'utilisateur">
              <UL items={[
                'Utiliser la plateforme conformément à sa destination et dans le respect des lois en vigueur',
                'Ne pas détourner le service à des fins illicites ou frauduleuses',
                'Se présenter au point de prise en charge aux heures convenues',
                'Respecter le véhicule et le chauffeur partenaire',
                'Ne pas dépasser le nombre de passagers autorisé par le véhicule',
              ]} />
            </Section>

            <Section title="5 — Annulations et no-show">
              <P>L&apos;annulation d&apos;une course est soumise à la politique d&apos;annulation décrite dans les CGV. En cas de no-show, des frais pourront être facturés conformément aux CGV.</P>
            </Section>

            <Section title="6 — Évaluations">
              <P>Après chaque course, l&apos;utilisateur est invité à évaluer la qualité du service. Les évaluations doivent être sincères, objectives et respectueuses. Owise se réserve le droit de supprimer tout avis diffamatoire ou manifestement abusif.</P>
            </Section>

            <Section title="7 — Responsabilité d'Owise">
              <P>Owise agit en qualité d&apos;intermédiaire de mise en relation et n&apos;est pas responsable des dommages causés pendant la course. Les chauffeurs partenaires sont des prestataires indépendants, couverts par leur propre assurance responsabilité civile professionnelle.</P>
            </Section>

            <Section title="8 — Modification des CGU">
              <P>Owise se réserve le droit de modifier les présentes CGU à tout moment. L&apos;utilisateur sera informé des modifications par e-mail ou notification dans l&apos;application.</P>
            </Section>

            <Section title="9 — Résiliation">
              <P>L&apos;utilisateur peut clôturer son compte à tout moment depuis les paramètres de son espace personnel ou en contactant <EM href="mailto:owise.entreprise@gmail.com">owise.entreprise@gmail.com</EM>.</P>
            </Section>
          </div>
        )}

        {/* ── CGV ── */}
        {active === 'cgv' && (
          <div>
            <InfoBox>Les présentes CGV s&apos;appliquent à toute commande de course effectuée via la plateforme Owise.</InfoBox>

            <Section title="1 — Tarification">
              <DefTable rows={[
                ['Prise en charge', 'Montant fixe selon la catégorie de véhicule'],
                ['Prix au km', 'Tarif kilométrique variable selon le véhicule'],
                ['Majorations', 'Nuit (+20%), week-end et jours fériés (+15–25%), aéroport (montant fixe)'],
                ['Attente', 'Gratuit les 5 premières minutes, puis tarif/min selon le véhicule'],
                ['Péages', 'Répercutés au coût réel si activé dans les paramètres'],
              ]} />
            </Section>

            <Section title="2 — Commande et confirmation">
              <P>La commande est finalisée lorsque l&apos;utilisateur confirme la réservation après avoir pris connaissance de l&apos;estimation tarifaire. En cas d&apos;absence de chauffeur disponible, aucun montant n&apos;est débité.</P>
            </Section>

            <Section title="3 — Paiement">
              <UL items={[
                'Carte bancaire (Visa, Mastercard, American Express)',
                'Apple Pay',
                'Google Pay',
                'Facturation mensuelle pour les comptes entreprise (sur accord préalable)',
              ]} />
              <P>Les paiements sont sécurisés par <Strong>Stripe</Strong>, certifié PCI DSS niveau 1. Owise ne stocke jamais les données de carte bancaire des utilisateurs.</P>
            </Section>

            <Section title="4 — Politique d'annulation">
              <DefTable rows={[
                ['Avant attribution', 'Annulation gratuite à tout moment'],
                ['Après attribution — moins de 3 min', 'Annulation gratuite'],
                ['Après attribution — 3 à 10 min', 'Frais d\'annulation de 3 €'],
                ['Après attribution — plus de 10 min', 'Frais d\'annulation de 8 €'],
                ['No-show (chauffeur arrivé)', 'Frais égaux à la prise en charge + 5 min d\'attente'],
              ]} />
            </Section>

            <Section title="5 — Remboursements">
              <P>Tout remboursement doit être signalé dans les <Strong>48 heures</Strong> suivant la course via l&apos;espace client ou à <EM href="mailto:owise.entreprise@gmail.com">owise.entreprise@gmail.com</EM>. Les remboursements validés sont effectués dans un délai de 5 à 10 jours ouvrés.</P>
            </Section>

            <Section title="6 — Facturation entreprise">
              <P>Les entreprises bénéficiant d&apos;un contrat cadre reçoivent une facture mensuelle récapitulant l&apos;ensemble des courses. Le paiement est dû à 30 jours date de facture.</P>
            </Section>

            <Section title="7 — Droit de rétractation">
              <P>Conformément à l&apos;article L. 221-28 du Code de la consommation, le droit de rétractation ne s&apos;applique pas aux services de transport dont l&apos;exécution a commencé avec l&apos;accord du consommateur.</P>
            </Section>

            <Section title="8 — Litiges">
              <P>En cas de litige, contactez le service client à <EM href="mailto:owise.entreprise@gmail.com">owise.entreprise@gmail.com</EM> ou par téléphone aux heures ouvrées.</P>
            </Section>
          </div>
        )}

        {/* ── Confidentialité ── */}
        {active === 'confidentialite' && (
          <div>
            <InfoBox>Owise est attachée à la protection de vos données personnelles, conformément au RGPD (Règlement UE 2016/679).</InfoBox>

            <Section title="1 — Responsable du traitement">
              <P><Strong>Owise SAS</Strong>, dont le siège est à Paris, est responsable du traitement de vos données personnelles. Contact DPO : <EM href="mailto:privacy@owise.fr">privacy@owise.fr</EM>.</P>
            </Section>

            <Section title="2 — Données collectées">
              <DefTable rows={[
                ['Identité', 'Nom, prénom, adresse e-mail, numéro de téléphone'],
                ['Connexion', 'Identifiants, mots de passe hachés, tokens de session'],
                ['Géolocalisation', 'Position de prise en charge et de destination (uniquement pendant la course)'],
                ['Paiement', 'Token de paiement Stripe (jamais les données de carte)'],
                ['Courses', 'Historique des trajets, montants, évaluations'],
                ['Navigation', 'Adresse IP, type de navigateur (si cookies analytiques acceptés)'],
              ]} />
            </Section>

            <Section title="3 — Finalités du traitement">
              <UL items={[
                <><Strong>Exécution du service</Strong> — fourniture des courses, suivi en temps réel, paiement</>,
                <><Strong>Gestion du compte</Strong> — création, authentification, historique</>,
                <><Strong>Obligation légale</Strong> — facturation, archivage comptable, lutte contre la fraude</>,
                <><Strong>Amélioration du service</Strong> — analyse statistique anonymisée (avec consentement)</>,
                <><Strong>Communication</Strong> — notifications de course, e-mails transactionnels</>,
              ]} />
            </Section>

            <Section title="4 — Durées de conservation">
              <DefTable rows={[
                ['Compte actif', 'Durée de vie du compte + 3 ans après la dernière connexion'],
                ['Historique courses', '5 ans (obligation comptable)'],
                ['Données de connexion', '12 mois (logs de sécurité)'],
                ['Cookies analytiques', '13 mois maximum'],
                ['Après suppression', 'Anonymisation immédiate des données non légalement archivées'],
              ]} />
            </Section>

            <Section title="5 — Partage des données">
              <P>Owise ne vend jamais vos données personnelles. Elles peuvent être partagées avec :</P>
              <UL items={[
                <><Strong>Chauffeurs partenaires</Strong> — prénom, numéro de téléphone masqué, point de prise en charge</>,
                <><Strong>Prestataires techniques</Strong> — Stripe, Firebase, Google Maps, Supabase — encadrés par des DPA</>,
                <><Strong>Autorités compétentes</Strong> — en cas d&apos;obligation légale</>,
              ]} />
            </Section>

            <Section title="6 — Transferts hors UE">
              <P>Certains prestataires (Stripe, Firebase) sont établis aux États-Unis. Ces transferts sont encadrés par des clauses contractuelles types approuvées par la Commission européenne, conformément à l&apos;article 46 du RGPD.</P>
            </Section>

            <Section title="7 — Vos droits">
              <UL items={[
                <><Strong>Accès</Strong> — obtenir une copie de vos données</>,
                <><Strong>Rectification</Strong> — corriger des données inexactes</>,
                <><Strong>Suppression</Strong> — effacement de vos données (sous réserve des obligations légales)</>,
                <><Strong>Portabilité</Strong> — recevoir vos données dans un format structuré</>,
                <><Strong>Opposition</Strong> — s&apos;opposer à certains traitements</>,
                <><Strong>Retrait du consentement</Strong> — révoquer un consentement à tout moment</>,
              ]} />
              <P>Pour exercer ces droits : <EM href="mailto:privacy@owise.fr">privacy@owise.fr</EM>. Vous pouvez également introduire une réclamation auprès de la <Strong>CNIL</Strong> (<EM href="https://www.cnil.fr" target="_blank">cnil.fr</EM>).</P>
            </Section>

            <Section title="8 — Cookies">
              <P>Owise utilise des cookies essentiels (fonctionnement du service), analytiques (analyse d&apos;audience) et marketing. Vous pouvez gérer vos préférences via notre bandeau de consentement.</P>
            </Section>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 48, paddingTop: 20,
          borderTop: '1px solid rgba(0,0,0,.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontSize: 11, color: '#9B9B9B', fontFamily: 'var(--font-jetbrains, monospace)' }}>
            Dernière mise à jour : 26 mai 2026
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['Accueil', '/'], ['Contact DPO', 'mailto:privacy@owise.fr'], ['Support', 'mailto:owise.entreprise@gmail.com']].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 11, color: '#9B9B9B', textDecoration: 'none' }}>{label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
