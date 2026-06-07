// Service Worker Firebase Cloud Messaging — Owise
// Ce fichier DOIT être à la racine /public pour que Firebase puisse le trouver

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// La config est injectée dynamiquement via ?config= au moment de l'installation
// (voir ChauffeurApp.tsx)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    // Évite "Firebase App already exists" si le SW est déjà actif
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config)
    }
    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification ?? {}
      if (!title) return
      self.registration.showNotification(title, {
        body: body ?? '',
        icon: '/brand_assets/favicon.svg',
        badge: '/brand_assets/favicon.svg',
        vibrate: [200, 100, 200],
        data: { url: payload.fcmOptions?.link ?? '/chauffeur' },
      })
    })
  }
})

// Clic sur la notification → ouvrir l'app chauffeur
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/chauffeur'
  event.waitUntil(clients.openWindow(url))
})
