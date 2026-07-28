import { useState, useEffect, useRef } from 'react'
import { Upload, X } from 'lucide-react'

const MAX_SIZE       = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

// Upload de imagem com clique + drag-and-drop, usado em todo lugar que tem
// print de loja (ControleSemanal, Lojas, Onboard...).
//
// `value` aceita um File recém-selecionado OU uma URL/dataURL já existente
// (string) — o componente resolve o preview certo pra cada caso. `onChange`
// recebe o File bruto (validação de tamanho/tipo já feita aqui) ou `null` ao
// remover; quem chama decide o que fazer com o File (upload, FileReader, etc).

export default function ImageUpload({ label, value, onChange, onError, onPreviewClick }) {
  const [dragOver, setDragOver] = useState(false)
  const [hover,    setHover]    = useState(false)
  const [objectUrl, setObjectUrl] = useState(null)
  const inputRef    = useRef(null)
  // Contador de enter/leave — sem ele, o dragleave que dispara ao passar do
  // pai pro ícone/texto filho (que tecnicamente é um leave+enter em sequência)
  // zera o estado ativo no meio do arraste, piscando o estilo.
  const dragCounter = useRef(0)

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [value])

  const previewSrc = value instanceof File ? objectUrl : (value || null)

  function validarEEnviar(file) {
    if (!file) return
    if (file.size > MAX_SIZE) { onError?.('Imagem muito grande. Máximo 5MB.'); return }
    if (!ACCEPTED_TYPES.includes(file.type)) { onError?.('Use PNG ou JPG.'); return }
    onChange(file)
  }

  function handleInputChange(e) {
    validarEEnviar(e.target.files?.[0])
    e.target.value = ''
  }

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragOver(true)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    validarEEnviar(e.dataTransfer.files?.[0])
  }

  function handleRemove(e) {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div>
      {label && (
        <p style={{ fontSize: '11px', color: '#999999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </p>
      )}

      {previewSrc ? (
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => onPreviewClick?.(previewSrc)}
          style={{ position: 'relative', height: '96px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E8E8', cursor: onPreviewClick ? 'zoom-in' : 'default' }}
        >
          <img src={previewSrc} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div
            onDragOver={e => e.preventDefault()}
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: hover ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
              transition: 'background-color 150ms',
            }}
          >
            {hover && (
              <button
                type="button"
                onClick={handleRemove}
                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color="#fff" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            height: '96px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
            border: `2px dashed ${dragOver ? '#EA1D2C' : '#E8E8E8'}`,
            backgroundColor: dragOver ? '#FFF0F1' : '#FAFAFA',
            borderRadius: '8px', padding: '20px', boxSizing: 'border-box', cursor: 'pointer',
            transition: 'border-color 150ms, background-color 150ms',
          }}
        >
          <Upload size={24} strokeWidth={1.5} color={dragOver ? '#EA1D2C' : '#BBBBBB'} style={{ pointerEvents: 'none' }} />
          <span style={{ fontSize: '13px', color: dragOver ? '#EA1D2C' : '#999999', textAlign: 'center', lineHeight: 1.3, pointerEvents: 'none' }}>
            {dragOver ? 'Solte para adicionar' : 'Arraste uma imagem ou clique para selecionar'}
          </span>
          {!dragOver && (
            <span style={{ fontSize: '11px', color: '#BBBBBB', pointerEvents: 'none' }}>PNG ou JPG até 5MB</span>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
    </div>
  )
}
