import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import PlatformBadge from './PlatformBadge'
import { UF_POR_CODAREA, UF_INFO, REGIOES_ORDEM, normalizarUF } from '../../utils/brasil'

const MALHA_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo+json&qualidade=minima'

// Ícone padrão do Leaflet quebra com bundlers (os caminhos de imagem não
// resolvem) — substitui por um pin simples em SVG inline, sem depender de
// nenhum arquivo de imagem.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.8 20.2 0 13 0z" fill="#E5322D"/>
    <circle cx="13" cy="13" r="5.5" fill="#FFFFFF"/>
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -30],
})

const BRASIL_CENTER = [-14.235, -51.9253]

// Zoom a partir do qual troca pro tile "de verdade" (com nome de rua,
// prédios etc) — abaixo disso fica só no estilo claro/minimalista da marca,
// sem a poluição visual (verde de parque, azul forte de água, ícones) do
// tile padrão do OpenStreetMap. Suficiente pra confirmar a região/cidade;
// o detalhe de rua só aparece quando a pessoa já deu bastante zoom.
const ZOOM_TROCA_TILE_DETALHADO = 16

const TILE_MARCA = {
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
}
const TILE_DETALHADO = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

function TileConformeZoom({ zoomInicial }) {
  const [detalhado, setDetalhado] = useState(zoomInicial >= ZOOM_TROCA_TILE_DETALHADO)
  useMapEvents({
    zoomend(e) { setDetalhado(e.target.getZoom() >= ZOOM_TROCA_TILE_DETALHADO) },
  })
  const tile = detalhado ? TILE_DETALHADO : TILE_MARCA
  return <TileLayer attribution={tile.attribution} url={tile.url} />
}

// Preenchimento translúcido (laranja da marca) nos estados com loja — visível
// no zoom afastado (mapa do país inteiro) e vai sumindo conforme dá zoom,
// até restar só o contorno colorido. Reagenda o estilo a cada zoomend porque
// o Leaflet não recalcula sozinho um `style` que depende do zoom atual.
const FILL_ZOOM_CHEIO = 5  // <= isso: preenchimento no máximo
const FILL_ZOOM_VAZIO = 8  // >= isso: sem preenchimento, só contorno

function opacidadePreenchimento(zoom) {
  if (zoom <= FILL_ZOOM_CHEIO) return 0.3
  if (zoom >= FILL_ZOOM_VAZIO) return 0
  return 0.3 * (1 - (zoom - FILL_ZOOM_CHEIO) / (FILL_ZOOM_VAZIO - FILL_ZOOM_CHEIO))
}

function ContornoEstados({ geoData, ufsAtendidas, zoomInicial }) {
  const [zoom, setZoom] = useState(zoomInicial)
  useMapEvents({
    zoomend(e) { setZoom(e.target.getZoom()) },
  })

  function estiloEstado(feature) {
    const uf = UF_POR_CODAREA[feature.properties.codarea]
    const atendida = uf && ufsAtendidas[uf] > 0
    return {
      color: atendida ? '#E5322D' : '#BBBBBB',
      weight: atendida ? 2.5 : 1,
      opacity: atendida ? 0.9 : 0.35,
      fillColor: '#F97316',
      fillOpacity: atendida ? opacidadePreenchimento(zoom) : 0,
    }
  }

  return <GeoJSON data={geoData} style={estiloEstado} interactive={false} />
}

function FitBounds({ pontos }) {
  const map = useMap()
  useMemo(() => {
    if (pontos.length === 0) return
    if (pontos.length === 1) {
      map.setView([pontos[0].lat, pontos[0].lng], 13)
      return
    }
    const bounds = L.latLngBounds(pontos.map(p => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos.length])
  return null
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
}

// Mapa único de lojas: pins reais (endereço geolocalizado) num mapa de
// verdade, com o menu lateral e o contorno de estados atendidos que antes
// viviam no Mapa Institucional — que existia separado só pra gerar uma
// imagem estilizada de divulgação, função removida daqui (sem exportação).
export default function MapaLojasModal({ isOpen, onClose, lojas, clienteMap, gestorMap }) {
  const [geoData, setGeoData] = useState(null)
  const [ufsColapsados, setUfsColapsados] = useState(() => new Set())

  useEffect(() => {
    if (!isOpen || geoData) return
    fetch(MALHA_URL)
      .then(r => { if (!r.ok) throw new Error('Falha ao carregar malha do IBGE'); return r.json() })
      .then(gj => setGeoData(gj))
      .catch(err => console.error('[MapaLojasModal] erro ao carregar malha do IBGE:', err))
  }, [isOpen, geoData])

  function toggleUf(uf) {
    setUfsColapsados(prev => {
      const next = new Set(prev)
      if (next.has(uf)) next.delete(uf)
      else next.add(uf)
      return next
    })
  }

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

  // Cidades atendidas, agrupadas por UF — cada loja com estado + cidade
  // preenchidos vira uma linha na lista (2 lojas na mesma cidade somam count).
  const cidadesPorUf = useMemo(() => {
    const map = {}
    ;(lojas ?? []).forEach(l => {
      const uf = normalizarUF(l.endereco?.estado)
      const cidade = (l.endereco?.cidade ?? '').trim()
      if (!uf || !cidade) return
      map[uf] = map[uf] ?? {}
      map[uf][cidade] = (map[uf][cidade] ?? 0) + 1
    })
    const resultado = {}
    Object.entries(map).forEach(([uf, cidades]) => {
      resultado[uf] = Object.entries(cidades)
        .map(([cidade, count]) => ({ cidade, count }))
        .sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR'))
    })
    return resultado
  }, [lojas])

  const pontos = useMemo(() => {
    return (lojas ?? [])
      .filter(l => l.endereco?.lat != null && l.endereco?.lng != null)
      .map(l => ({
        id: l.id,
        lat: l.endereco.lat,
        lng: l.endereco.lng,
        nome: l.nome,
        cidade: l.endereco.cidade,
        estado: l.endereco.estado,
        clienteNome: clienteMap?.[l.clienteId]?.nome,
        gestorNome:  gestorMap?.[l.gestorId]?.nome,
        plataformas: l.plataformas?.length ? l.plataformas : (l.plataforma ? [l.plataforma] : []),
      }))
  }, [lojas, clienteMap, gestorMap])

  const totalLojas = lojas?.length ?? 0

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
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>Mapa das Lojas</h2>
              <p style={{ fontSize: '12px', color: '#999999', marginTop: '2px' }}>
                {pontos.length} de {totalLojas} loja{totalLojas !== 1 ? 's' : ''} com endereço geolocalizado
              </p>
            </div>
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

          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* Sidebar */}
            <div style={{ width: '260px', flexShrink: 0, padding: '24px 20px', borderRight: '1px solid #E8E8E8', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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
                Estados e cidades atendidos ({Object.keys(ufsAtendidas).length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {REGIOES_ORDEM.filter(r => regioesAtendidas.includes(r)).map(regiao => (
                  <div key={regiao} style={{ marginBottom: '10px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '6px 0 4px' }}>
                      {regiao}
                    </p>
                    {Object.keys(ufsAtendidas)
                      .filter(uf => UF_INFO[uf]?.regiao === regiao)
                      .sort((a, b) => UF_INFO[a].nome.localeCompare(UF_INFO[b].nome, 'pt-BR'))
                      .map(uf => {
                        const colapsado = ufsColapsados.has(uf)
                        return (
                          <div key={uf} style={{ padding: '4px 0' }}>
                            <button
                              type="button"
                              onClick={() => toggleUf(uf)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {colapsado
                                  ? <ChevronRight size={12} strokeWidth={2} color="#BBBBBB" />
                                  : <ChevronDown size={12} strokeWidth={2} color="#BBBBBB" />}
                                <span style={{ fontSize: '13px', fontWeight: 500, color: '#111111' }}>{UF_INFO[uf].nome}</span>
                              </span>
                              <span className="font-mono" style={{ fontSize: '11px', color: '#999999' }}>{ufsAtendidas[uf]}</span>
                            </button>
                            {!colapsado && (cidadesPorUf[uf] ?? []).map(({ cidade, count }) => (
                              <div key={cidade} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0 2px 16px' }}>
                                <span style={{ fontSize: '12px', color: '#666666' }}>{cidade}</span>
                                <span className="font-mono" style={{ fontSize: '11px', color: '#BBBBBB' }}>{count}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '10px', color: '#BBBBBB', marginTop: '16px', lineHeight: 1.5 }}>
                Número de lojas atendidas por estado
              </p>
            </div>

            {/* Mapa */}
            <div style={{ flex: 1, position: 'relative' }}>
              {!geoData && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={12} className="animate-spin" color="#999999" />
                  <span style={{ fontSize: '11px', color: '#999999' }}>Carregando contorno dos estados…</span>
                </div>
              )}
              <MapContainer center={BRASIL_CENTER} zoom={4} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
                <TileConformeZoom zoomInicial={4} />
                {geoData && <ContornoEstados geoData={geoData} ufsAtendidas={ufsAtendidas} zoomInicial={4} />}
                <FitBounds pontos={pontos} />
                {pontos.map(p => (
                  <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon}>
                    <Popup>
                      <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '160px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111111', margin: '0 0 4px' }}>{p.nome}</p>
                        {(p.cidade || p.estado) && (
                          <p style={{ fontSize: '12px', color: '#666666', margin: '0 0 4px' }}>
                            {[p.cidade, p.estado].filter(Boolean).join(' — ')}
                          </p>
                        )}
                        {p.clienteNome && (
                          <p style={{ fontSize: '12px', color: '#666666', margin: '0 0 2px' }}>Cliente: {p.clienteNome}</p>
                        )}
                        {p.gestorNome && (
                          <p style={{ fontSize: '12px', color: '#666666', margin: '0 0 6px' }}>Gestor: {p.gestorNome}</p>
                        )}
                        {p.plataformas.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {p.plataformas.map(pl => <PlatformBadge key={pl} plataforma={pl} />)}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
