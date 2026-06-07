/**
 * Génère owise-signature.wav — signature sonore Owise
 * Arpège D4 → F#4 → A4, timbre cloche dorée (harmoniques additifs)
 *
 * Usage : node scripts/generate-owise-sound.mjs
 * Output: public/sounds/owise-signature.wav
 *         public/sounds/owise-alert.wav
 *         public/sounds/owise-terminee.wav
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT   = join(__dir, '../public/sounds')
mkdirSync(OUT, { recursive: true })

const SR = 44100  // sample rate

// ── Synthèse ────────────────────────────────────────────────────

function envelope(t, attack, decay) {
  if (t < attack) return t / attack
  return Math.exp(-4 * (t - attack) / (decay - attack))
}

function additiveSine(t, freq, harmonics) {
  let s = Math.sin(2 * Math.PI * freq * t)
  for (const h of harmonics) s += h.vol * Math.sin(2 * Math.PI * freq * h.ratio * t)
  return s
}

const OW_H = [{ ratio: 2, vol: 0.28 }, { ratio: 3, vol: 0.09 }, { ratio: 4, vol: 0.04 }]

function renderNote(freq, duration, vol, harmonics = OW_H) {
  const n = Math.floor(SR * duration)
  const samples = new Float32Array(n)
  const attack  = 0.007
  for (let i = 0; i < n; i++) {
    const t = i / SR
    samples[i] = vol * envelope(t, attack, duration) * additiveSine(t, freq, harmonics)
  }
  return samples
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

function silence(ms) {
  return new Float32Array(Math.floor(SR * ms / 1000))
}

// ── Rendu des sons ───────────────────────────────────────────────

const D4  = 293.66, Fs4 = 369.99, A4  = 440.00
const D5  = 587.33, A5  = 880.00, Fs5 = 739.99
const Fs4h = [{ ratio: 2, vol: 0.2 }]

// Signature : D4 → F#4 → A4
const signature = concat(
  renderNote(D4,  0.24, 0.60),
  silence(35),
  renderNote(Fs4, 0.24, 0.65),
  silence(35),
  renderNote(A4,  0.60, 0.75),
)

// Alerte : ping A5
const alert = concat(
  renderNote(A5, 0.20, 0.55, [{ ratio: 2, vol: 0.3 }, { ratio: 3, vol: 0.08 }]),
)

// Terminée : D5 → A4 → F#4 → D4
const terminee = concat(
  renderNote(D5,  0.22, 0.45),
  silence(45),
  renderNote(A4,  0.22, 0.40),
  silence(45),
  renderNote(Fs4, 0.22, 0.35),
  silence(45),
  renderNote(D4,  0.50, 0.30),
)

// ── Export WAV ───────────────────────────────────────────────────

function toWav(samples) {
  const numSamples = samples.length
  const byteRate   = SR * 2  // 16-bit mono
  const dataSize   = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)

  buf.write('RIFF',   0); buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE',   8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16,  16)  // chunk size
  buf.writeUInt16LE(1,   20)  // PCM
  buf.writeUInt16LE(1,   22)  // mono
  buf.writeUInt32LE(SR,  24)
  buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(2,   32)  // block align
  buf.writeUInt16LE(16,  34)  // bits per sample
  buf.write('data',  36); buf.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

writeFileSync(join(OUT, 'owise-signature.wav'), toWav(signature))
writeFileSync(join(OUT, 'owise-alert.wav'),     toWav(alert))
writeFileSync(join(OUT, 'owise-terminee.wav'),  toWav(terminee))

console.log('✓ Générés dans public/sounds/')
console.log('  owise-signature.wav  — nouvelle course (D4→F#4→A4, ~1s)')
console.log('  owise-alert.wav      — devis / alerte (~0.2s)')
console.log('  owise-terminee.wav   — course terminée (~1.1s)')
console.log()
console.log('Prochaines étapes mobile :')
console.log('  Android : copier dans android/app/src/main/res/raw/')
console.log('  iOS     : copier dans ios/<AppName>/ + ajouter au bundle Xcode')
