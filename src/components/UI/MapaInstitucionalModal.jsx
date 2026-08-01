import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { geoMercator, geoPath } from 'd3-geo'
import html2canvas from 'html2canvas'
import { X, Download, Loader2 } from 'lucide-react'
import { UF_POR_CODAREA, UF_INFO, REGIOES_ORDEM, normalizarUF } from '../../utils/brasil'

const MALHA_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo+json&qualidade=minima'

// A malha do IBGE vem com os anéis dos polígonos na orientação oposta à que
// o d3-geo espera — sem corrigir, cada estado é interpretado como "o globo
// inteiro menos essa área" (bounds vira o mundo todo). Inverte a ordem dos
// pontos de cada anel antes de projetar.
function corrigirOrientacao(geometry) {
  const inverterAnel = anel => anel.slice().reverse()
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(inverterAnel) }
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(poligono => poligono.map(inverterAnel)) }
  }
  return geometry
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
}

// Mapa institucional/estilizado pra divulgação (Instagram etc) — visual na
// identidade da marca, diferente do mapa operacional de pins (esse aqui não
// mostra endereço exato de loja, só destaca estados/regiões atendidos.
export default function MapaInstitucionalModal({ isOpen, onClose, lojas }) {
  const [geoData,  setGeoData]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(null)
  const [exporting, setExporting] = useState(false)
  const captureRef = useRef(null)

  useEffect(() => {
    if (!isOpen || geoData) return
    setLoading(true)
    setErro(null)
    fetch(MALHA_URL)
      .then(r => { if (!r.ok) throw new Error('Falha ao carregar malha do IBGE'); return r.json() })
      .then(gj => setGeoData({
        ...gj,
        features: gj.features.map(f => ({ ...f, geometry: corrigirOrientacao(f.geometry) })),
      }))
      .catch(err => setErro(err.message))
      .finally(() => setLoading(false))
  }, [isOpen, geoData])

  const ufsAtendidas = useMemo(() => {
    const map = {}
    ;(lojas ?? []).forEach(l => {
      const uf = normalizarUF(l.endereco?.estado)
      if (!uf) return
      map[uf] = (map[uf] ?? 0) + 1
    })
    return map
  }, [lojas])

  const regioesAtendidas = useMemo(() => {
    const set = new Set(Object.keys(ufsAtendidas).map(uf => UF_INFO[uf]?.regiao).filter(Boolean))
    return REGIOES_ORDEM.filter(r => set.has(r))
  }, [ufsAtendidas])

  const { pathFor, project, viewBox } = useMemo(() => {
    if (!geoData) return { pathFor: () => '', project: () => null, viewBox: '0 0 520 520' }
    const width = 520, height = 520
    const projection = geoMercator().fitExtent([[16, 16], [width - 16, height - 16]], geoData)
    const path = geoPath(projection)
    return {
      pathFor: feature => path(feature) ?? '',
      project: (lng, lat) => projection([lng, lat]),
      viewBox: `0 0 ${width} ${height}`,
    }
  }, [geoData])

  // Pins das lojas com coordenadas — projetados no mesmo espaço do mapa.
  const pontos = useMemo(() => {
    if (!geoData) return []
    return (lojas ?? [])
      .filter(l => l.endereco?.lat != null && l.endereco?.lng != null)
      .map(l => {
        const xy = project(l.endereco.lng, l.endereco.lat)
        return xy ? { id: l.id, x: xy[0], y: xy[1] } : null
      })
      .filter(Boolean)
  }, [lojas, geoData, project])

  async function handleExportar() {
    if (!captureRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(captureRef.current, { backgroundColor: '#FFFFFF', scale: 2 })
      const link = document.createElement('a')
      link.download = 'ihubfood-regioes-atendidas.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setExporting(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col"
          style={{ background: '#F7F7F8' }}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center justify-between shrink-0" style={{ padding: '14px 20px', borderBottom: '1px solid #E8E8E8', backgroundColor: '#FFFFFF' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>Mapa Institucional</h2>
              <p style={{ fontSize: '12px', color: '#999999', marginTop: '2px' }}>Regiões atendidas — pronto pra divulgação</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportar}
                disabled={loading || !!erro || exporting}
                className="btn-primary flex items-center gap-2"
                style={{ height: '34px', fontSize: '13px', padding: '0 14px' }}
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2} />}
                {exporting ? 'Gerando…' : 'Baixar imagem'}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#666666',
                }}
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 20px' }}>
            {loading ? (
              <div className="flex items-center justify-center" style={{ width: '100%' }}>
                <Loader2 size={22} className="animate-spin" color="#999999" />
              </div>
            ) : erro ? (
              <p style={{ fontSize: '13px', color: '#DC2626', alignSelf: 'center' }}>Erro ao carregar o mapa: {erro}</p>
            ) : (
              <div
                ref={captureRef}
                style={{
                  display: 'flex', width: '100%', maxWidth: '960px',
                  backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
                  overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }}
              >
                {/* Sidebar */}
                <div style={{ width: '260px', flexShrink: 0, padding: '28px 24px', borderRight: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#E5322D',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
                      iHub<span style={{ color: '#E5322D' }}>Food</span>
                    </p>
                  </div>
                  <p style={{ fontSize: '11px', color: '#999999', marginBottom: '24px' }}>Presença nacional</p>

                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Regiões atendidas
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '22px' }}>
                    {regioesAtendidas.map(r => (
                      <span key={r} style={{
                        fontSize: '11px', fontWeight: 500, color: '#E5322D', backgroundColor: '#FFF5F5',
                        border: '1px solid #FECACA', borderRadius: '999px', padding: '3px 10px',
                      }}>
                        {r}
                      </span>
                    ))}
                    {regioesAtendidas.length === 0 && (
                      <span style={{ fontSize: '12px', color: '#BBBBBB' }}>Nenhuma loja com estado cadastrado</span>
                    )}
                  </div>

                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Estados atendidos ({Object.keys(ufsAtendidas).length})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, overflowY: 'auto' }}>
                    {REGIOES_ORDEM.filter(r => regioesAtendidas.includes(r)).map(regiao => (
                      <div key={regiao} style={{ marginBottom: '10px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '6px 0 4px' }}>
                          {regiao}
                        </p>
                        {Object.keys(ufsAtendidas)
                          .filter(uf => UF_INFO[uf]?.regiao === regiao)
                          .sort((a, b) => UF_INFO[a].nome.localeCompare(UF_INFO[b].nome, 'pt-BR'))
                          .map(uf => (
                            <div key={uf} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                              <span style={{ fontSize: '13px', color: '#111111' }}>{UF_INFO[uf].nome}</span>
                              <span className="font-mono" style={{ fontSize: '11px', color: '#999999' }}>{ufsAtendidas[uf]}</span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '10px', color: '#BBBBBB', marginTop: '16px', lineHeight: 1.5 }}>
                    Número de lojas atendidas por estado
                  </p>
                </div>

                {/* Mapa */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: '#FCFCFC' }}>
                  <svg viewBox={viewBox} style={{ width: '100%', maxWidth: '480px', height: 'auto' }}>
                    {geoData?.features.map(feature => {
                      const uf = UF_POR_CODAREA[feature.properties.codarea]
                      const atendida = uf && ufsAtendidas[uf] > 0
                      return (
                        <path
                          key={feature.properties.codarea}
                          d={pathFor(feature)}
                          fill={atendida ? '#E5322D' : '#F0F0F0'}
                          fillOpacity={atendida ? 0.88 : 1}
                          stroke="#FFFFFF"
                          strokeWidth={1.2}
                          strokeLinejoin="round"
                        />
                      )
                    })}
                    {pontos.map(p => (
                      <circle
                        key={p.id}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="#111111"
                        stroke="#FFFFFF"
                        strokeWidth={1.4}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
