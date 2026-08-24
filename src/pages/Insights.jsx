import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, query, where, getDocs,
} from '../services/firebase'
import { getLastNWeeks, getISOWeekStr, weekLabel } from '../utils/semanas'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const listVariants = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
}

// Mesmo critério de status usado no Dashboard — tolerante a variações de grafia
function lojaAtiva(l) {
  return ['ativa', 'ativo'].includes(l.status?.toLowerCase())
}

// Espelha o WarnBadge de ControleSemanal.jsx (thresholds e semântica idênticos)
function emAlerta(val, threshold, abaixo = false) {
  const n = parseFloat(val)
  if (isNaN(n)) return false
  return abaixo ? n < threshold : n > threshold
}

function detectarMotivos(resultadosOrdenados) {
  // resultadosOrdenados: resultados da loja, mais recente primeiro
  const motivos = []
  const [ultimo] = resultadosOrdenados
  if (!ultimo) return motivos

  if (emAlerta(ultimo.variacao, -10, true)) {
    motivos.push({ tipo: 'queda', texto: `Queda de ${ultimo.variacao.toFixed(1)}% na última semana` })
  }
  if (emAlerta(ultimo.chamados, 2.5)) {
    motivos.push({ tipo: 'chamados', texto: `Chamados em ${ultimo.chamados.toFixed(1)}%` })
  }
  if (emAlerta(ultimo.cancelamento, 1)) {
    motivos.push({ tipo: 'cancelamento', texto: `Cancelamentos em ${ultimo.cancelamento.toFixed(1)}%` })
  }
  if (emAlerta(ultimo.tempoAberto, 95, true)) {
    motivos.push({ tipo: 'tempoAberto', texto: `Tempo de loja aberta em ${ultimo.tempoAberto.toFixed(1)}%` })
  }

  // Queda há mais de 2 semanas seguidas: as 3 semanas mais recentes com dados,
  // todas com variação negativa (2+ semanas consecutivas em queda = pelo menos 3 pontos)
  const recentes = resultadosOrdenados.slice(0, 3)
  if (recentes.length >= 3 && recentes.every(r => (r.variacao ?? 0) < 0)) {
    motivos.push({ tipo: 'tendencia', texto: 'Em queda há mais de 2 semanas seguidas' })
  }

  return motivos
}

export default function Insights() {
  const { user, isSuperAdmin } = useAuth()
  const [carregando, setCarregando] = useState(true)
  const [lojasEmAlerta, setLojasEmAlerta] = useState([])

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      try {
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]

        const lojasSnap = await getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg))
        let lojas = lojasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(lojaAtiva)
        if (user.role === 'gestor') {
          lojas = lojas.filter(l => l.gestorId === user.uid)
        }
        if (lojas.length === 0) {
          if (!cancelado) { setLojasEmAlerta([]); setCarregando(false) }
          return
        }

        const semanaRef = getISOWeekStr()
        const ultimas4Semanas = getLastNWeeks(semanaRef, 4)
        const resultadosSnap = await getDocs(query(
          collection(db, COLLECTIONS.RESULTADOS),
          ...escopoOrg,
          where('semana', 'in', ultimas4Semanas),
        ))
        const resultados = resultadosSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const porLoja = new Map()
        resultados.forEach(r => {
          if (!porLoja.has(r.lojaId)) porLoja.set(r.lojaId, [])
          porLoja.get(r.lojaId).push(r)
        })

        const alertas = []
        lojas.forEach(loja => {
          const resLoja = (porLoja.get(loja.id) ?? []).sort((a, b) => b.semana.localeCompare(a.semana))
          if (resLoja.length === 0) return
          const motivos = detectarMotivos(resLoja)
          if (motivos.length > 0) {
            alertas.push({ loja, motivos, ultimaSemana: resLoja[0].semana })
          }
        })

        alertas.sort((a, b) => b.motivos.length - a.motivos.length)

        if (!cancelado) setLojasEmAlerta(alertas)
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    if (user) carregar()
    return () => { cancelado = true }
  }, [user, isSuperAdmin])

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      <div className="page-header">
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Análises e destaques sobre os resultados das lojas.</p>
      </div>

      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: '10px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F3F3', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="#FF4B2E" strokeWidth={2} />
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#111111' }}>Lojas em alerta</h2>
            <p style={{ fontSize: '12px', color: '#999999' }}>
              Queda por 2+ semanas seguidas, variação abaixo de -10%, chamados acima de 2,5%, cancelamentos acima de 1% ou tempo de loja aberta abaixo de 95%
            </p>
          </div>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {carregando ? (
            <p style={{ fontSize: '13px', color: '#999999' }}>Carregando...</p>
          ) : lojasEmAlerta.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#999999' }}>Nenhuma loja em alerta nesta semana.</p>
          ) : (
            <motion.div
              variants={listVariants}
              initial="initial"
              animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {lojasEmAlerta.map(({ loja, motivos, ultimaSemana }) => (
                <motion.div
                  key={loja.id}
                  variants={itemVariants}
                  style={{
                    backgroundColor: '#FFF1ED',
                    border: '1px solid #FECACA',
                    borderLeft: '3px solid #FF4B2E',
                    borderRadius: '6px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{loja.nome}</span>
                    <span style={{ fontSize: '11px', color: '#999999' }}>{weekLabel(ultimaSemana)}</span>
                  </div>
                  <ul style={{ marginTop: '4px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {motivos.map((m, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#DC2626', listStyleType: 'disc' }}>
                        {m.texto}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      <div
        className="flex flex-col items-center justify-center text-center gap-3"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: '10px',
          padding: '48px 24px',
          marginTop: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Lightbulb size={24} strokeWidth={1.5} color="#BBBBBB" />
        <p style={{ fontSize: '13px', color: '#999999', maxWidth: '360px' }}>
          Mais análises em breve.
        </p>
      </div>
    </motion.div>
  )
}
