// Sons générés via Web Audio API — aucun fichier externe requis

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return ctx
}

function beep(freq: number, duration: number, vol = 0.4, type: OscillatorType = 'sine'): Promise<void> {
  return new Promise(resolve => {
    const c = getCtx()
    if (!c) { resolve(); return }
    const osc  = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.frequency.value = freq
    osc.type = type
    gain.gain.setValueAtTime(vol, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
    osc.onended = () => resolve()
  })
}

/** Nouvelle course assignée — 3 bips montants urgents */
export async function soundNouvelleCourse() {
  await beep(440, 0.18, 0.5, 'square')
  await new Promise(r => setTimeout(r, 60))
  await beep(550, 0.18, 0.5, 'square')
  await new Promise(r => setTimeout(r, 60))
  await beep(660, 0.28, 0.6, 'square')
}

/** Confirmation action (accepter, démarrer, etc.) — 2 bips doux */
export async function soundConfirmation() {
  await beep(520, 0.14, 0.3)
  await new Promise(r => setTimeout(r, 80))
  await beep(660, 0.18, 0.3)
}

/** Course terminée — chime descendant */
export async function soundTerminee() {
  await beep(880, 0.2, 0.35)
  await new Promise(r => setTimeout(r, 50))
  await beep(660, 0.2, 0.3)
  await new Promise(r => setTimeout(r, 50))
  await beep(440, 0.35, 0.25)
}

/** Alerte légère — 1 bip court */
export async function soundAlert() {
  await beep(600, 0.15, 0.3, 'triangle')
}

/** Réveiller le contexte audio après interaction utilisateur */
export function resumeAudioCtx() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume()
}
