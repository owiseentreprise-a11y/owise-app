import admin from 'firebase-admin'

// Initialisation unique (singleton)
function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!

  const projectId  = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) return null as any

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

export async function envoyerNotifChauffeur(params: {
  fcmToken:  string
  title:     string
  body:      string
  data?:     Record<string, string>
}): Promise<boolean> {
  const { fcmToken, title, body, data } = params
  if (!fcmToken) return false

  try {
    const app = getApp()
    if (!app) {
      console.warn('[FCM] Clés Firebase manquantes — notification ignorée')
      return false
    }

    await admin.messaging(app).send({
      token: fcmToken,
      notification: { title, body },
      data: data ?? {},
      webpush: {
        notification: {
          title,
          body,
          icon: '/brand_assets/favicon.svg',
          badge: '/brand_assets/favicon.svg',
          vibrate: [200, 100, 200],
        },
        fcmOptions: { link: '/chauffeur' },
      },
      android: {
        priority: 'high',
        notification: { title, body, icon: 'ic_notification', sound: 'default' },
      },
    })
    return true
  } catch (err: any) {
    console.error('[FCM] Erreur envoi notification:', err?.message ?? err)
    return false
  }
}
