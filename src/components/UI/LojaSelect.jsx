import { useState, useEffect, useRef, useMemo } from 'react'
import { X } from 'lucide-react'
import PlatformBadge from './PlatformBadge'

// Busca com autocomplete pra seleção de loja — substitui os <select> simples
// usados em ControleSemanal/Comparativo/Atividades/Dashboard/etc.
//
// Props:
//   lojas      — array de lojas visíveis ao usuário (já filtradas por gestor/admin)
//   value      — lojaId selecionado (ou '')
//   onChange   — (lojaId) => void — chamado com '' quando a seleção é limpa
//   gestorMap  — opcional, { [gestorId]: { nome } } — mostra o gestor na lista
//   placeholder, className, style — repassados pro input/wrapper

function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function LojaSelect({ lojas, value, onChange, gestorMap = {}, placeholder = 'Buscar loja...', className = '', style }) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef     = useRef(null)
  const blurTimeout  = useRef(null)

  const lojaSelecionada = useMemo(() => lojas.find(l => l.id === value) ?? null, [lojas, value])

  // Sincroniza o texto exibido com a seleção real sempre que ela mudar por fora
  // (ex: outro filtro resetando o valor) — não roda enquanto o usuário edita.
  useEffect(() => {
    if (!open) setQuery(lojaSelecionada?.nome ?? '')
  }, [lojaSelecionada]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (blurTimeout.current) clearTimeout(blurTimeout.current) }, [])

  const lojasOrdenadas = useMemo(
    () => [...lojas].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
    [lojas]
  )

  const filtradas = useMemo(() => {
    const termo = normalizar(query)
    if (!termo) return lojasOrdenadas
    return lojasOrdenadas.filter(l => normalizar(l.nome).includes(termo))
  }, [lojasOrdenadas, query])

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setFocused(true)
    setOpen(true)
    setQuery('') // limpa pra permitir buscar/trocar livremente; restaura no blur se nada for escolhido
  }

  function handleBlur() {
    setFocused(false)
    blurTimeout.current = setTimeout(() => {
      setOpen(false)
      setQuery(lojaSelecionada?.nome ?? '')
    }, 150)
  }

  function handleSelect(loja) {
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null }
    onChange(loja.id)
    setQuery(loja.nome)
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); inputRef.current?.blur() } }}
        placeholder={placeholder}
        style={{
          width: '100%', height: '36px', fontSize: '13px', color: '#111111',
          border: `1px solid ${focused ? '#EA1D2C' : '#E8E8E8'}`, borderRadius: '6px',
          padding: value ? '0 32px 0 12px' : '0 12px',
          outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
          transition: 'border-color 150ms',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999999', display: 'flex', padding: '4px' }}
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
            backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: '240px', overflowY: 'auto',
          }}
        >
          {filtradas.length === 0 ? (
            <p style={{ padding: '10px 12px', fontSize: '12px', color: '#999999', margin: 0 }}>Nenhuma loja encontrada.</p>
          ) : (
            filtradas.map(l => {
              const selecionada = l.id === value
              const plataformas = l.plataformas?.length ? l.plataformas : (l.plataforma ? [l.plataforma] : [])
              const gestorNome  = gestorMap[l.gestorId]?.nome
              return (
                <div
                  key={l.id}
                  onClick={() => handleSelect(l)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', cursor: 'pointer',
                    backgroundColor: selecionada ? '#FFF0F1' : 'transparent',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={e => { if (!selecionada) e.currentTarget.style.backgroundColor = '#F9F9F9' }}
                  onMouseLeave={e => { if (!selecionada) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: selecionada ? '#EA1D2C' : '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.nome}
                  </span>
                  {plataformas.map(p => <PlatformBadge key={p} plataforma={p} />)}
                  {gestorNome && (
                    <span style={{ fontSize: '11px', color: '#999999', flexShrink: 0, whiteSpace: 'nowrap' }}>{gestorNome}</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
