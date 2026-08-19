import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { X, ChevronDown, ChevronRight, ChevronLeft, Loader2, MapPinOff, PanelLeft } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import PlatformBadge from './PlatformBadge'
import { UF_POR_CODAREA, UF_INFO, REGIOES_ORDEM, normalizarUF } from '../../utils/brasil'
import { geocodificar } from '../../utils/geocodificar'
import { db, COLLECTIONS, doc, updateDoc } from '../../services/firebase'

const MALHA_URL = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo+json&qualidade=minima'

// Ícone padrão do Leaflet quebra com bundlers (os caminhos de imagem não
// resolvem) — substitui por um pin simples em SVG inline, sem depender de
// nenhum arquivo de imagem. Quando a loja divide coordenada com outra(s)
// (mesmo endereço), desloca o ícone por um valor fixo em PIXELS (via
// iconAnchor) em vez de em graus de lat/lng — um deslocamento geográfico
// vira poucos pixels (ou nenhum) quando o mapa está bem afastado, enquanto
// o deslocamento em pixel mantém os pins visualmente lado a lado, como uma
// sequência, em qualquer nível de zoom.
const OFFSET_PIN_PX = 10
const iconesPorPosicao = new Map()

// Cacheia por (posição no grupo × parado/caindo × duração da queda) — é
// essencial que o ícone de um pin já pousado seja sempre a MESMA instância
// entre renders: se `pinIcon` devolvesse um `L.divIcon` novo a cada chamada,
// o Leaflet chama `marker.setIcon()` (troca o nó no DOM) em TODOS os pins já
// visíveis a cada re-render do componente pai — não só no pin novo — e isso
// reinicia a animação CSS de queda em todo mundo ao mesmo tempo, mesmo quem
// já tinha pousado. Só o pin recém-adicionado (chovendo=true) deve animar;
// os anteriores reaproveitam o ícone parado cacheado, sem novo nó no DOM.
function pinIcon(indiceNoGrupo = 0, totalNoGrupo = 1, chovendo = false, quedaMs = 400) {
  const meio = (totalNoGrupo - 1) / 2
  const deslocamentoPx = (indiceNoGrupo - meio) * OFFSET_PIN_PX
  const chave = `${indiceNoGrupo}-${totalNoGrupo}-${chovendo ? quedaMs : 'parado'}`
  if (iconesPorPosicao.has(chave)) return iconesPorPosicao.get(chave)

  const svgHtml = `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.8 20.2 0 13 0z" fill="#FF4B2E"/>
      <circle cx="13" cy="13" r="5.5" fill="#FFFFFF"/>
    </svg>`
  const html = chovendo
    ? `<div class="pin-chuva" style="animation-duration:${quedaMs}ms">${svgHtml}</div>`
    : svgHtml

  const icon = L.divIcon({
    className: '',
    html,
    iconSize: [26, 34],
    iconAnchor: [13 - deslocamentoPx, 34],
    popupAnchor: [deslocamentoPx, -30],
  })
  iconesPorPosicao.set(chave, icon)
  return icon
}

const BRASIL_CENTER = [-14.235, -51.9253]

// Lojas com o mesmo endereço geocodificam pro mesmíssimo lat/lng — sem
// tratamento, um pin fica exatamente em cima do outro e só o de cima
// responde a clique. Agrupa por coordenada (arredondada pra absorver
// variações de ponto flutuante) e marca a posição de cada uma dentro do
// grupo, pro ícone deslocar em pixels e virarem uma sequência visível.
function espalharColisoes(pontos) {
  const grupos = new Map()
  pontos.forEach(p => {
    const chave = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(p)
  })
  const resultado = []
  grupos.forEach(grupo => {
    grupo.forEach((p, i) => {
      resultado.push({ ...p, indiceGrupo: i, totalGrupo: grupo.length })
    })
  })
  return resultado
}

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
      className: 'estado-contorno',
      color: atendida ? '#FF4B2E' : '#BBBBBB',
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
export default function MapaLojasModal({ isOpen, onClose, lojas, clienteMap, gestorMap, onLojaGeocodificada }) {
  const [geoData, setGeoData] = useState(null)
  // Cidades ficam escondidas por padrão — guarda quais UFs a pessoa abriu,
  // em vez de quais escondeu, pra não precisar pré-popular com todas as UFs.
  const [ufsExpandidos, setUfsExpandidos] = useState(() => new Set())
  // Menu lateral começa recolhido — o mapa é o foco principal, a lista de
  // estados/cidades é um complemento que a pessoa abre quando precisa.
  const [sidebarAberta, setSidebarAberta] = useState(false)

  useEffect(() => {
    if (!isOpen || geoData) return
    fetch(MALHA_URL)
      .then(r => { if (!r.ok) throw new Error('Falha ao carregar malha do IBGE'); return r.json() })
      .then(gj => setGeoData(gj))
      .catch(err => console.error('[MapaLojasModal] erro ao carregar malha do IBGE:', err))
  }, [isOpen, geoData])

  function toggleUf(uf) {
    setUfsExpandidos(prev => {
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
    const base = (lojas ?? [])
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
    return espalharColisoes(base)
  }, [lojas, clienteMap, gestorMap])

  // Ordena sul → norte (latitude mais negativa primeiro, já que no Brasil o
  // sul fica em torno de -33° e o norte perto do equador) — é a ordem em que
  // os pins "chovem" quando o mapa abre.
  const pontosOrdenados = useMemo(() => [...pontos].sort((a, b) => a.lat - b.lat), [pontos])

  // Quantos pins já "pousaram" — sobe de 1 em 1, começando do zero toda vez
  // que o modal reabre. O contorno dos estados usa esse mesmo índice pra ir
  // revelando a cor conforme os pins daquele estado caem.
  const [pinsVisiveis, setPinsVisiveis] = useState(0)

  // Duração da queda de UM pin — o intervalo entre pins é IGUAL a essa
  // duração (nunca menor), então o próximo só começa a cair quando o
  // anterior já pousou: é isso que garante "um de cada vez" em vez de vários
  // caindo ao mesmo tempo. Encolhe um pouco com muitas lojas (piso 220ms)
  // só pra não esticar demais o total, mas continua estritamente sequencial.
  const quedaMs = useMemo(
    () => Math.round(Math.max(220, Math.min(500, 4500 / Math.max(pontosOrdenados.length, 1)))),
    [pontosOrdenados.length]
  )

  useEffect(() => {
    if (!isOpen) { setPinsVisiveis(0); return }
    if (pontosOrdenados.length === 0) return
    setPinsVisiveis(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setPinsVisiveis(i)
      if (i >= pontosOrdenados.length) clearInterval(id)
    }, quedaMs)
    return () => clearInterval(id)
  }, [isOpen, pontosOrdenados.length, quedaMs])

  const pontosVisiveis = useMemo(() => pontosOrdenados.slice(0, pinsVisiveis), [pontosOrdenados, pinsVisiveis])

  // UFs "reveladas" até agora — o contorno some pintado assim que o primeiro
  // pin daquele estado pousa, não espera todos os pins do país.
  const ufsReveladas = useMemo(() => {
    const set = new Set()
    pontosVisiveis.forEach(p => {
      const uf = normalizarUF(p.estado)
      if (uf) set.add(uf)
    })
    return set
  }, [pontosVisiveis])

  const ufsAtendidasReveladas = useMemo(() => {
    const map = {}
    ufsReveladas.forEach(uf => { map[uf] = ufsAtendidas[uf] })
    return map
  }, [ufsReveladas, ufsAtendidas])

  // Lojas com cidade/estado preenchidos mas sem coordenada — aparecem na
  // lista lateral (contam pro total do estado) mas não têm pin no mapa.
  // Acontece com lojas cadastradas antes do geocode existir, ou cujo
  // endereço nunca passou pelo blur que dispara a geocodificação.
  const pendentesGeocode = useMemo(() => {
    return (lojas ?? []).filter(l =>
      (l.endereco?.lat == null || l.endereco?.lng == null) && (l.endereco?.cidade || l.endereco?.estado)
    )
  }, [lojas])

  const [geocodificando, setGeocodificando] = useState(false)
  const [progressoGeocode, setProgressoGeocode] = useState(null)

  // Roda uma loja de cada vez, respeitando o limite de 1 req/s do Nominatim
  // (uso gratuito) — em paralelo a API bloqueia e a geocodificação falha.
  async function geocodificarPendentes() {
    setGeocodificando(true)
    try {
      for (let i = 0; i < pendentesGeocode.length; i++) {
        const loja = pendentesGeocode[i]
        setProgressoGeocode({ atual: i + 1, total: pendentesGeocode.length })
        try {
          const geo = await geocodificar(loja.endereco)
          if (geo) {
            await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), {
              'endereco.lat': geo.lat,
              'endereco.lng': geo.lng,
            })
            onLojaGeocodificada?.(loja.id, geo)
          }
        } catch (err) {
          console.error(`[MapaLojasModal] falha ao geocodificar "${loja.nome}":`, err)
        }
        if (i < pendentesGeocode.length - 1) await new Promise(r => setTimeout(r, 1100))
      }
    } finally {
      setGeocodificando(false)
      setProgressoGeocode(null)
    }
  }

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
          {/* Animação de "chuva de pins" + contorno dos estados ganhando cor
              conforme os pins pousam — pin-chuva toca sozinha ao entrar no
              DOM (cada marker só monta uma vez); estado-contorno anima a
              transição de opacidade quando o React troca o style do GeoJSON. */}
          <style>{`
            @keyframes pinChuva {
              0%   { transform: translateY(-560px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
            .pin-chuva {
              /* easeOutExpo — cai rápido e desacelera suave até parar
                 exatamente na posição final, sem quicar nem oscilar. */
              animation: pinChuva 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .estado-contorno {
              transition: fill-opacity 450ms ease, opacity 400ms ease, stroke-opacity 400ms ease;
            }
          `}</style>
          <div className="flex items-center justify-between shrink-0" style={{ padding: '14px 20px', borderBottom: '1px solid #E8E8E8', backgroundColor: '#FFFFFF' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>Mapa das Lojas</h2>
              <p style={{ fontSize: '12px', color: '#999999', marginTop: '2px' }}>
                {pontos.length} de {totalLojas} loja{totalLojas !== 1 ? 's' : ''} com endereço geolocalizado
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {pendentesGeocode.length > 0 && (
                <button
                  type="button"
                  onClick={geocodificarPendentes}
                  disabled={geocodificando}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', fontSize: '12px', opacity: geocodificando ? 0.6 : 1 }}
                >
                  {geocodificando
                    ? <Loader2 size={13} className="animate-spin" />
                    : <MapPinOff size={13} strokeWidth={1.75} />}
                  {geocodificando
                    ? `Geocodificando ${progressoGeocode?.atual ?? 1}/${progressoGeocode?.total ?? pendentesGeocode.length}…`
                    : `Geocodificar ${pendentesGeocode.length} pendente${pendentesGeocode.length !== 1 ? 's' : ''}`}
                </button>
              )}
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

          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* Sidebar */}
            <div style={{
              width: sidebarAberta ? '260px' : '48px',
              flexShrink: 0,
              borderRight: '1px solid #E8E8E8',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'width 0.2s ease',
            }}>
              <button
                type="button"
                onClick={() => setSidebarAberta(v => !v)}
                aria-label={sidebarAberta ? 'Recolher menu' : 'Expandir menu'}
                title={sidebarAberta ? 'Recolher menu' : 'Expandir menu'}
                style={{
                  width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#666666',
                  margin: sidebarAberta ? '16px 20px 0 auto' : '16px auto 0',
                }}
              >
                {sidebarAberta ? <ChevronLeft size={16} strokeWidth={1.75} /> : <PanelLeft size={16} strokeWidth={1.75} />}
              </button>

              {sidebarAberta && (
                <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto', minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#FF4B2E',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
                      iHub<span style={{ color: '#FF4B2E' }}>Food</span>
                    </p>
                  </div>
                  <p style={{ fontSize: '11px', color: '#999999', marginBottom: '24px' }}>Presença nacional</p>

                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#999999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Regiões atendidas
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '22px' }}>
                    {regioesAtendidas.map(r => (
                      <span key={r} style={{
                        fontSize: '11px', fontWeight: 500, color: '#FF4B2E', backgroundColor: '#FFF5F5',
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
                            const colapsado = !ufsExpandidos.has(uf)
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
              )}
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
                {geoData && <ContornoEstados geoData={geoData} ufsAtendidas={ufsAtendidasReveladas} zoomInicial={4} />}
                <FitBounds pontos={pontos} />
                {pontosVisiveis.map((p, i) => (
                  <Marker
                    key={p.id}
                    position={[p.lat, p.lng]}
                    icon={pinIcon(p.indiceGrupo, p.totalGrupo, i === pinsVisiveis - 1, quedaMs)}
                  >
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
