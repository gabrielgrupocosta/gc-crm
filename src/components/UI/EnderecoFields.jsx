import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export const EMPTY_ENDERECO = {
  cep: '', logradouro: '', numero: '', bairro: '', cidade: '', estado: '',
  lat: null, lng: null,
}

function formatCep(v) {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

// Busca endereço + coordenadas pelo CEP. BrasilAPI (v2) traz os dois numa
// chamada só quando disponível (dado do IBGE); cai pro ViaCEP (sem
// coordenadas) se a BrasilAPI falhar ou não tiver o CEP.
async function buscarCep(cepDigits) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepDigits}`)
    if (r.ok) {
      const d = await r.json()
      return {
        logradouro: d.street ?? '',
        bairro:     d.neighborhood ?? '',
        cidade:     d.city ?? '',
        estado:     d.state ?? '',
        lat:        d.location?.coordinates?.latitude  ? Number(d.location.coordinates.latitude)  : null,
        lng:        d.location?.coordinates?.longitude ? Number(d.location.coordinates.longitude) : null,
      }
    }
  } catch { /* cai pro fallback abaixo */ }

  const r2 = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
  if (!r2.ok) return null
  const d2 = await r2.json()
  if (d2.erro) return null
  return {
    logradouro: d2.logradouro ?? '',
    bairro:     d2.bairro ?? '',
    cidade:     d2.localidade ?? '',
    estado:     d2.uf ?? '',
    lat: null, lng: null,
  }
}

// Sem coordenadas do CEP (comum fora de capitais): geocodifica pelo
// endereço via Nominatim (OpenStreetMap, gratuito, sem chave) pra garantir
// que a loja apareça no mapa mesmo assim — menos precisa, mas resolve.
async function geocodificar(endereco) {
  const partes = [endereco.logradouro, endereco.bairro, endereco.cidade, endereco.estado, 'Brasil'].filter(Boolean)
  if (partes.length < 2) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(partes.join(', '))}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const arr = await r.json()
    if (!arr.length) return null
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) }
  } catch {
    return null
  }
}

// Campos de endereço reutilizáveis (Lojas) — CEP preenche o resto
// automaticamente (e busca coordenadas pro mapa), mas todo campo continua
// editável manualmente pra corrigir ou completar.
export default function EnderecoFields({ value, onChange }) {
  const [buscando, setBuscando] = useState(false)
  const endereco = value ?? EMPTY_ENDERECO

  function set(key, v) {
    onChange({ ...endereco, [key]: v })
  }

  async function handleCepBlur() {
    const digits = (endereco.cep ?? '').replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscando(true)
    try {
      const dados = await buscarCep(digits)
      if (!dados) return
      let { lat, lng } = dados
      if (lat == null || lng == null) {
        const geo = await geocodificar({ ...endereco, ...dados })
        if (geo) { lat = geo.lat; lng = geo.lng }
      }
      onChange({
        ...endereco,
        logradouro: dados.logradouro || endereco.logradouro,
        bairro:     dados.bairro     || endereco.bairro,
        cidade:     dados.cidade     || endereco.cidade,
        estado:     dados.estado     || endereco.estado,
        lat: lat ?? endereco.lat ?? null,
        lng: lng ?? endereco.lng ?? null,
      })
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="section-label">Endereço</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="end-cep">CEP</label>
          <div className="relative">
            <input
              id="end-cep"
              type="text"
              inputMode="numeric"
              value={endereco.cep}
              onChange={e => set('cep', formatCep(e.target.value))}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              className="input font-mono"
              style={{ height: '36px', fontSize: '13px' }}
            />
            {buscando && (
              <Loader2 size={14} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" color="#999999" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5" style={{ gridColumn: 'span 1' }}>
          <label className="field-label" htmlFor="end-numero">Número</label>
          <input
            id="end-numero"
            type="text"
            value={endereco.numero}
            onChange={e => set('numero', e.target.value)}
            placeholder="Ex: 123"
            className="input"
            style={{ height: '36px', fontSize: '13px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="field-label" htmlFor="end-bairro">Bairro</label>
          <input
            id="end-bairro"
            type="text"
            value={endereco.bairro}
            onChange={e => set('bairro', e.target.value)}
            placeholder="Ex: Centro"
            className="input"
            style={{ height: '36px', fontSize: '13px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-2">
          <label className="field-label" htmlFor="end-logradouro">Rua</label>
          <input
            id="end-logradouro"
            type="text"
            value={endereco.logradouro}
            onChange={e => set('logradouro', e.target.value)}
            placeholder="Ex: Av. Brasil"
            className="input"
            style={{ height: '36px', fontSize: '13px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="end-cidade">Cidade</label>
          <input
            id="end-cidade"
            type="text"
            value={endereco.cidade}
            onChange={e => set('cidade', e.target.value)}
            placeholder="Ex: São Paulo"
            className="input"
            style={{ height: '36px', fontSize: '13px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="field-label" htmlFor="end-estado">Estado</label>
          <input
            id="end-estado"
            type="text"
            maxLength={2}
            value={endereco.estado}
            onChange={e => set('estado', e.target.value.toUpperCase())}
            placeholder="Ex: SP"
            className="input font-mono"
            style={{ height: '36px', fontSize: '13px' }}
          />
        </div>
      </div>
    </div>
  )
}
