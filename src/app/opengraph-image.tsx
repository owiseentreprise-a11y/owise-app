import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Owise — Transport VTC de Prestige · Paris & IDF'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09091A',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Halo doré en arrière-plan */}
        <div style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
        }} />

        {/* Ligne dorée horizontale haut */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
          display: 'flex',
        }} />

        {/* Contenu */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

          {/* Logo cercle */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #C9A84C, #8B6A1A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
          }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: '#09091A', fontFamily: 'Georgia, serif' }}>O</span>
          </div>

          {/* OWISE */}
          <div style={{
            fontSize: 72,
            fontWeight: 600,
            color: '#C9A84C',
            letterSpacing: '0.2em',
            fontFamily: 'Georgia, serif',
            marginBottom: 8,
            display: 'flex',
          }}>
            OWISE
          </div>

          {/* Sous-titre */}
          <div style={{
            fontSize: 18,
            color: 'rgba(237,232,223,0.6)',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontFamily: 'Georgia, serif',
            marginBottom: 44,
            display: 'flex',
          }}>
            TRANSPORT DE PRESTIGE
          </div>

          {/* Séparateur doré */}
          <div style={{
            width: 80,
            height: 1,
            background: 'rgba(201,168,76,0.4)',
            marginBottom: 40,
            display: 'flex',
          }} />

          {/* Description */}
          <div style={{
            fontSize: 22,
            color: 'rgba(237,232,223,0.75)',
            fontFamily: 'Georgia, serif',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.5,
            display: 'flex',
          }}>
            Chauffeurs professionnels · Tarif fixe garanti · 24h/24
          </div>

          {/* Zones */}
          <div style={{
            marginTop: 20,
            fontSize: 15,
            color: 'rgba(201,168,76,0.65)',
            letterSpacing: '0.12em',
            fontFamily: 'Georgia, serif',
            display: 'flex',
            gap: 16,
          }}>
            <span>Paris</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Île-de-France</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Oise</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>CDG · Orly · Beauvais</span>
          </div>
        </div>

        {/* URL en bas */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          fontSize: 14,
          color: 'rgba(201,168,76,0.45)',
          letterSpacing: '0.1em',
          fontFamily: 'Georgia, serif',
          display: 'flex',
        }}>
          owise.fr
        </div>

        {/* Ligne dorée horizontale bas */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
          display: 'flex',
        }} />
      </div>
    ),
    { ...size }
  )
}
