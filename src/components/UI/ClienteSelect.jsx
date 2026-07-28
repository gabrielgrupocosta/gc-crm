import { useState, useEffect, useRef, useMemo } from 'react'
import { X } from 'lucide-react'
import Badge from './Badge'

// Busca com autocomplete pra seleção de cliente — usado no campo "Cliente
// vinculado" do formulário de loja. Espelha o LojaSelect.
//
// Props:
//   clientes   — array de clientes disponíveis
//   value      — clienteId selecionado (ou '')
//   onChange   — (clienteId) => void — chamado com '' quando a seleção é limpa
//   placeholder, className, style — repassados pro input/wrapper

function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function ClienteSelect({ clientes, value, onChange, placeholder = 'Buscar cliente...', className = '', style }) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef    = useRef(null)
  const blurTimeout = useRef(null)

  const clienteSelecionado = useMemo(() => clientes.find(c => c.id === value) ?? null, [clientes, value])

  // Sincroniza o texto exibido com a seleção real sempre que ela mudar por fora
  // (ex: cliente recém-criado no mini modal) — não roda enquanto o usuário edita.
  useEffect(() => {
    if (!open) setQuery(clienteSelecionado?.nome ?? '')
  }, [clienteSelecionado]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (blurTimeout.current) clearTimeout(blurTimeout.current) }, [])

  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
    [clientes]
  )

  const filtrados = useMemo(() => {
    const termo = normalizar(query)
    if (!termo) return clientesOrdenados
    return clientesOrdenados.filter(c => normalizar(c.nome).includes(termo))
  }, [clientesOrdenados, query])

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setFocused(true)
    setOpen(true)
    setQuery('')
  }

  function handleBlur() {
    setFocused(false)
    blurTimeout.current = setTimeout(() => {
      setOpen(false)
      setQuery(clienteSelecionado?.nome ?? '')
    }, 150)
  }

  function handleSelect(cliente) {
    if (blurTimeout.current) { clearTimeout(blurTimeout.current); blurTimeout.current = null }
    onChange(cliente.id)
    setQuery(cliente.nome)
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
          {filtrados.length === 0 ? (
            <p style={{ padding: '10px 12px', fontSize: '12px', color: '#999999', margin: 0 }}>Nenhum cliente encontrado.</p>
          ) : (
            filtrados.map(c => {
              const selecionado = c.id === value
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', cursor: 'pointer',
                    backgroundColor: selecionado ? '#FFF0F1' : 'transparent',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={e => { if (!selecionado) e.currentTarget.style.backgroundColor = '#F9F9F9' }}
                  onMouseLeave={e => { if (!selecionado) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: selecionado ? '#EA1D2C' : '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nome}
                  </span>
                  {c.status && <Badge status={c.status?.toLowerCase()} label={c.status} />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
