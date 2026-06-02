'use client'

import { useEffect } from 'react'

// Config Firebase client (variables NEXT_PUBLIC_*)
const FB_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

export function useFcmRegistration() {
  useEffect(() => {
    // Ne rien faire si les variables Firebase ne sont pas configurées
    if (!FB_CONFIG.apiKey || !VAPID_KEY) return
    // Ne rien faire si le navigateur ne supporte pas les notifications
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return

    registerFcm()
  }, [])
}

async function registerFcm() {
  try {
    // 1. Demander la permission
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    // 2. Enregistrer le service worker
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

    // 3. Envoyer la config au SW
    await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'FIREBASE_CONFIG', config: FB_CONFIG })

    // 4. Récupérer le token FCM via import dynamique
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, getToken } = await import('firebase/messaging')

    const app = getApps().length > 0
      ? getApps()[0]
      : initializeApp(FB_CONFIG as any)

    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })

    if (!token) return

    // 5. Sauvegarder le token via l'API route (authentifiée)
    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch (err) {
    // Erreur silencieuse — les notifs ne sont pas critiques
    console.warn('[FCM] Enregistrement impossible:', err)
  }
}
