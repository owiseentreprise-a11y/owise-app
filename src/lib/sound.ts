// Signature sonore Owise — Web Audio API, aucun fichier externe
// Architecture : fondamentale + harmoniques + envelope ADSR → timbre de "cloche dorée"

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return ctx
}

type Harmonic = { ratio: number; vol: number }

/**
 * Joue un ton riche (fondamentale + harmoniques).
 * attack  : montée progressive (évite le clic brutal)
 * decay   : durée totale du son
 * harmonics : partiels additifs → timbre chaud, pas un bip électronique
 */
function tone(
  freq: number,
  duration: number,
  opts: {
    vol?: number
    attack?: number
    decay?: number
    type?: OscillatorType
    harmonics?: Harmonic[]
  } = {},
): Promise<void> {
  return new Promise(resolve => {
    const c = getCtx()
    if (!c) { setTimeout(resolve, duration * 1000); return }

    const {
      vol       = 0.55,
      attack    = 0.007,
      decay     = duration,
      type      = 'sine',
      harmonics = [],
    } = opts

    const ac     = c as AudioContext
    const master = ac.createGain()
    master.connect(ac.destination)

    function addOsc(f: number, v: number) {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.connect(gain)
      gain.connect(master)
      osc.frequency.value = f
      osc.type = type
      gain.gain.setValueAtTime(0, ac.currentTime)
      gain.gain.linearRampToValueAtTime(v, ac.currentTime + attack)
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + decay)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + decay + 0.05)
    }

    addOsc(freq, vol)
    harmonics.forEach(h => addOsc(freq * h.ratio, vol * h.vol))

    setTimeout(resolve, duration * 1000)
  })
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Harmoniques signature Owise ──────────────────────────────────
// Octave (×2) + quinte octaviée (×3) = timbre chaud et reconnaissable
const OW: Harmonic[] = [
  { ratio: 2,   vol: 0.28 },
  { ratio: 3,   vol: 0.09 },
  { ratio: 4,   vol: 0.04 },
]

// ── Fréquences — arpège Ré majeur (D4 → F#4 → A4) ───────────────
// Chaleureux, montant, impossible à confondre avec WhatsApp/SMS/systèmes
const D4  = 293.66
const Fs4 = 369.99
const A4  = 440.00
const D5  = 587.33
const A5  = 880.00
const Fs5 = 739.99
const C5  = 523.25

/**
 * NOUVELLE COURSE — signature complète Owise
 * 3 notes montantes D4→F#4→A4, ~1 seconde, fort et distinctif
 * Reconnaissable même à distance ou avec un fond sonore
 */
export async function soundNouvelleCourse() {
  await tone(D4,  0.20, { vol: 0.60, attack: 0.006, decay: 0.24, harmonics: OW })
  await wait(35)
  await tone(Fs4, 0.20, { vol: 0.65, attack: 0.006, decay: 0.24, harmonics: OW })
  await wait(35)
  await tone(A4,  0.55, { vol: 0.75, attack: 0.006, decay: 0.60, harmonics: OW })
}

/**
 * COURSE ASSIGNÉE / ACCEPTÉE — montée quinte (D4→A4), bref et net
 */
export async function soundCourseAssignee() {
  await tone(D4, 0.15, { vol: 0.50, attack: 0.005, decay: 0.18, harmonics: OW })
  await wait(45)
  await tone(A4, 0.30, { vol: 0.60, attack: 0.005, decay: 0.35, harmonics: OW })
}

/**
 * CONFIRMATION (bouton accepter, démarrer…) — 2 notes douces
 */
export async function soundConfirmation() {
  await tone(C5,  0.14, { vol: 0.38, attack: 0.005, decay: 0.18, harmonics: [{ ratio:2, vol:0.2 }] })
  await wait(55)
  await tone(D5,  0.22, { vol: 0.42, attack: 0.005, decay: 0.28, harmonics: [{ ratio:2, vol:0.2 }] })
}

/**
 * COURSE TERMINÉE — arpège descendant résolu (D5→A4→F#4→D4)
 * Signal "mission accomplie", apaisant
 */
export async function soundTerminee() {
  await tone(D5,  0.18, { vol: 0.45, decay: 0.22, harmonics: OW })
  await wait(45)
  await tone(A4,  0.18, { vol: 0.40, decay: 0.22, harmonics: OW })
  await wait(45)
  await tone(Fs4, 0.18, { vol: 0.35, decay: 0.22, harmonics: OW })
  await wait(45)
  await tone(D4,  0.45, { vol: 0.30, decay: 0.50, harmonics: OW })
}

/**
 * ALERTE / DEVIS — ping cristallin court (A5+octave)
 * Léger et aigu, attire l'attention sans alarmer
 */
export async function soundAlert() {
  await tone(A5, 0.18, {
    vol: 0.50, attack: 0.003, decay: 0.20,
    harmonics: [{ ratio: 2, vol: 0.3 }, { ratio: 3, vol: 0.08 }],
  })
}

/**
 * URGENCE (course sans chauffeur > seuil) — 3 pings courts et forts
 */
export async function soundUrgence() {
  for (let i = 0; i < 3; i++) {
    await tone(Fs5, 0.12, { vol: 0.70, attack: 0.003, decay: 0.14, harmonics: [{ ratio:2, vol:0.3 }] })
    await wait(90)
  }
}

/**
 * Réveiller le contexte audio après la première interaction utilisateur.
 * Appeler au clic sur n'importe quel élément.
 */
export function resumeAudioCtx() {
  const c = getCtx()
  if (c?.state === 'suspended') c.resume()
}
