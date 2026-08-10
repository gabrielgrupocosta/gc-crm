import { useState, useEffect, useCallback } from 'react'

// A cada 5min e sempre que a aba volta a ficar em foco — não precisa ser mais
// agressivo que isso, é só pra avisar o usuário de um deploy novo.
const INTERVALO_MS = 5 * 60 * 1000

export default function useVersaoApp() {
  const [novaVersaoDisponivel, setNovaVersaoDisponivel] = useState(false)

  const verificar = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { version } = await res.json()
      // Em dev (npm run dev) version.json não existe e __APP_VERSION__ é o
      // build atual — sem deploy real, nunca diverge.
      if (version && version !== __APP_VERSION__) {
        setNovaVersaoDisponivel(true)
      }
    } catch {
      // offline ou erro de rede — ignora, tenta de novo no próximo ciclo
    }
  }, [])

  useEffect(() => {
    verificar()
    const intervalId = setInterval(verificar, INTERVALO_MS)
    function aoFocar() {
      if (document.visibilityState === 'visible') verificar()
    }
    document.addEventListener('visibilitychange', aoFocar)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [verificar])

  function atualizar() {
    window.location.reload()
  }

  return { novaVersaoDisponivel, atualizar }
}
