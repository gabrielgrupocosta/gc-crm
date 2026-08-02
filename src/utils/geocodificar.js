async function buscarNominatim(partes) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(partes.join(', '))}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const arr = await r.json()
  if (!arr.length) return null
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) }
}

// Geocodifica um endereço pelo Nominatim (OpenStreetMap, gratuito, sem
// chave) — usado tanto ao preencher o endereço da loja (EnderecoFields)
// quanto no backfill de lojas antigas sem coordenadas (MapaLojasModal).
//
// Nominatim é sensível a como a rua está escrita: nomes com prefixo "Rua "/
// "Avenida " + bairro juntos frequentemente não batem com nada no índice
// (mesmo quando a rua existe), enquanto a mesma rua sem o prefixo, ou uma
// busca mais genérica, encontra. Por isso tenta do mais específico pro mais
// genérico, indo até cidade+estado — melhor um pin aproximado no centro da
// cidade do que nenhum pin.
export async function geocodificar(endereco) {
  const { logradouro, bairro, cidade, estado } = endereco
  const tentativas = []
  const vistos = new Set()
  for (const bruto of [
    [logradouro, bairro, cidade, estado, 'Brasil'],
    [logradouro, cidade, estado, 'Brasil'],
    [logradouro?.replace(/^(Rua|Avenida|Av\.?|Alameda|Travessa|Estrada|Rodovia)\s+/i, ''), cidade, estado, 'Brasil'],
    [cidade, estado, 'Brasil'],
  ]) {
    const partes = bruto.filter(Boolean)
    if (partes.length < 2) continue
    const chave = partes.join(', ')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    tentativas.push(partes)
  }

  for (let i = 0; i < tentativas.length; i++) {
    try {
      const geo = await buscarNominatim(tentativas[i])
      if (geo) return geo
    } catch {
      // tenta a próxima variante
    }
    if (i < tentativas.length - 1) await new Promise(r => setTimeout(r, 1100))
  }
  return null
}
