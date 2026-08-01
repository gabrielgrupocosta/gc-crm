import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import PlatformBadge from './PlatformBadge'

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

export default function MapaLojasModal({ isOpen, onClose, lojas, clienteMap, gestorMap }) {
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
          style={{ background: '#FFFFFF' }}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center justify-between shrink-0" style={{ padding: '14px 20px', borderBottom: '1px solid #E8E8E8' }}>
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

          <div style={{ flex: 1, minHeight: 0 }}>
            <MapContainer center={BRASIL_CENTER} zoom={4} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
