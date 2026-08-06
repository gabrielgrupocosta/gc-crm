importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyBrOl8KlLBqxINgaucxDjNRTu62YqRMMYc',
  authDomain:        'ihubfood.firebaseapp.com',
  projectId:         'ihubfood',
  storageBucket:     'ihubfood.firebasestorage.app',
  messagingSenderId: '454577135355',
  appId:             '1:454577135355:web:7db40d1de899e11395da5e',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  const fixa = payload.data?.fixa === 'true'
  const tag = payload.data?.tag || payload.data?.tipo || 'ihubfood-notificacao'

  self.registration.showNotification(title || 'iHubfood', {
    body: body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag,
    requireInteraction: fixa,
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
