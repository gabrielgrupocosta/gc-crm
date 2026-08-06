import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import {
  db, COLLECTIONS, messaging, messagingPronto,
  doc, updateDoc, arrayUnion, arrayRemove,
} from '../services/firebase'

// Gerada em: Console Firebase → Configurações do projeto → Cloud Messaging →
// Certificados push da Web. Sem ela, getToken() nunca retorna um token válido.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Registra o token do dispositivo em users/{uid}.fcmTokens (array — cada
// dispositivo/navegador tem o seu) e escuta mensagens em foreground.
// Notificação "fixa" usa Notification nativa (requireInteraction), pra não
// sumir sozinha mesmo com o app aberto; "normal" usa o Toast in-app já
// existente, evitando notificação duplicada do SO enquanto o usuário já está
// olhando pra tela.
export function useNotificacoesPush() {
  const { user } = useAuth()
  const toast = useToast()
  const [permissao, setPermissao] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const registrandoRef = useRef(false)

  async function pedirPermissao() {
    if (typeof Notification === 'undefined') return false
    const resultado = await Notification.requestPermission()
    setPermissao(resultado)
    if (resultado === 'granted') await registrarToken()
    return resultado === 'granted'
  }

  async function registrarToken() {
    if (!user || registrandoRef.current) return
    if (!VAPID_KEY) {
      console.warn('[useNotificacoesPush] VITE_FIREBASE_VAPID_KEY não configurada — push desativado')
      return
    }
    registrandoRef.current = true
    try {
      const suportado = await messagingPronto
      if (!suportado || !messaging || Notification.permission !== 'granted') return

      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      const { getToken } = await import('firebase/messaging')
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration })
      if (token) {
        await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { fcmTokens: arrayUnion(token) })
      }
    } catch (err) {
      console.error('[useNotificacoesPush] erro ao registrar token:', err?.code, err?.message)
    } finally {
      registrandoRef.current = false
    }
  }

  // Se a permissão já foi concedida antes (sessão anterior), garante o token
  // registrado sem precisar pedir de novo.
  useEffect(() => {
    if (user && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registrarToken()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Mensagens recebidas com o app em foreground (SW não dispara onBackgroundMessage nesse caso).
  useEffect(() => {
    if (!user) return
    let unsubscribe
    messagingPronto.then((suportado) => {
      if (!suportado || !messaging) return
      import('firebase/messaging').then(({ onMessage }) => {
        unsubscribe = onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {}
          const fixa = payload.data?.fixa === 'true'
          if (fixa) {
            if (Notification.permission === 'granted') {
              new Notification(title || 'iHubfood', { body: body || '', icon: '/logo.png', requireInteraction: true })
            }
          } else {
            toast(`${title ? title + ' — ' : ''}${body || ''}`, 'warning')
          }
        })
      })
    })
    return () => unsubscribe?.()
  }, [user, toast])

  // Remove um token inválido/expirado da conta — chamado quando o backend ou
  // o próprio client detecta falha de envio (ex: token desregistrado).
  async function removerToken(token) {
    if (!user) return
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { fcmTokens: arrayRemove(token) })
    } catch (err) {
      console.error('[useNotificacoesPush] erro ao remover token:', err?.code, err?.message)
    }
  }

  return { permissao, pedirPermissao, removerToken }
}
