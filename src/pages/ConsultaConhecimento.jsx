import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Send } from 'lucide-react'
import { auth } from '../services/firebase'

const CONSULTAR_WIKI_URL = 'https://consultarwiki-cxifjxir6a-uc.a.run.app'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// Chips mostram só o nome legível da página, não o caminho técnico
// (ex: "wiki/conceitos/precificacao-delivery.md" → "precificacao-delivery")
function nomePagina(caminho) {
  if (!caminho) return ''
  return caminho.split('/').pop().replace(/\.md$/i, '')
}

let proximoId = 1

export default function ConsultaConhecimento() {
  const [pergunta, setPergunta] = useState('')
  const [historico, setHistorico] = useState([])
  const [enviando, setEnviando] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [historico, enviando])

  async function handleSubmit(e) {
    e.preventDefault()
    const texto = pergunta.trim()
    if (!texto || enviando) return

    const id = proximoId++
    setHistorico(prev => [...prev, { id, pergunta: texto, resposta: null, paginasUsadas: [], erro: null }])
    setPergunta('')
    setEnviando(true)

    try {
      const idToken = await auth.currentUser.getIdToken()
      const res = await fetch(CONSULTAR_WIKI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pergunta: texto }),
      })

      if (res.status === 403) {
        setHistorico(prev => prev.map(item => item.id === id
          ? { ...item, erro: 'Acesso restrito — este usuário não tem permissão para consultar o conhecimento.' }
          : item))
        return
      }

      if (!res.ok) {
        setHistorico(prev => prev.map(item => item.id === id
          ? { ...item, erro: 'Não foi possível obter uma resposta agora. Tente novamente.' }
          : item))
        return
      }

      const data = await res.json()
      setHistorico(prev => prev.map(item => item.id === id
        ? { ...item, resposta: data.resposta ?? '', paginasUsadas: data.paginasUsadas ?? [] }
        : item))
    } catch {
      setHistorico(prev => prev.map(item => item.id === id
        ? { ...item, erro: 'Não foi possível obter uma resposta agora. Tente novamente.' }
        : item))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      <div className="page-header">
        <h1 className="page-title">Consulta ao conhecimento</h1>
        <p className="page-subtitle">Pergunte algo sobre a wiki pessoal — as fontes usadas aparecem abaixo de cada resposta.</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div className="bg-surface border border-border rounded-lg shadow-card" style={{ padding: '20px' }}>
          <div
            ref={scrollRef}
            className="flex flex-col gap-4"
            style={{ minHeight: '260px', maxHeight: '55vh', overflowY: 'auto', padding: '4px' }}
          >
            {historico.length === 0 && !enviando && (
              <div className="flex items-center justify-center" style={{ padding: '64px 0' }}>
                <p style={{ fontSize: '12px', color: '#999999' }}>Nenhuma pergunta feita ainda.</p>
              </div>
            )}

            {historico.map(item => (
              <div key={item.id} className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <div
                    style={{
                      maxWidth: '80%',
                      backgroundColor: '#FF4B2E',
                      color: '#FFFFFF',
                      borderRadius: '12px',
                      borderBottomRightRadius: '4px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      lineHeight: 1.5,
                    }}
                  >
                    {item.pergunta}
                  </div>
                </div>

                {item.erro && (
                  <div className="flex justify-start">
                    <div className="alert-danger" style={{ maxWidth: '80%', fontSize: '13px' }}>
                      {item.erro}
                    </div>
                  </div>
                )}

                {item.resposta !== null && !item.erro && (
                  <div className="flex flex-col items-start gap-2">
                    <div
                      style={{
                        maxWidth: '80%',
                        backgroundColor: '#F2F4F7',
                        color: '#111111',
                        borderRadius: '12px',
                        borderBottomLeftRadius: '4px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.resposta || '—'}
                    </div>

                    {item.paginasUsadas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" style={{ paddingLeft: '2px' }}>
                        {item.paginasUsadas.map((p, idx) => (
                          <span
                            key={idx}
                            title={p.caminho}
                            style={{
                              fontSize: '11px',
                              color: '#888888',
                              backgroundColor: '#F9F9F9',
                              border: '1px solid #E8E8E8',
                              borderRadius: '999px',
                              padding: '2px 10px',
                            }}
                          >
                            {nomePagina(p.caminho)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {enviando && (
              <div className="flex justify-start">
                <div
                  style={{
                    backgroundColor: '#F2F4F7',
                    borderRadius: '12px',
                    borderBottomLeftRadius: '4px',
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#999999' }}>Consultando…</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2" style={{ marginTop: '16px', borderTop: '1px solid #F0F0F0', paddingTop: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#BBBBBB' }} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '32px' }}
                placeholder="O que você quer saber?"
                value={pergunta}
                onChange={e => setPergunta(e.target.value)}
                disabled={enviando}
              />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={enviando || !pergunta.trim()}>
              <Send size={14} />
              Enviar
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
