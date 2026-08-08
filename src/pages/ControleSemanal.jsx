import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { AlertTriangle, Loader2, Copy, Check, X as XIcon, Download, Pencil, Sparkles } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext'
import { useModoTeste } from '../contexts/ModoTesteContext'
import {
  db, functions, COLLECTIONS, uploadImagem,
  collection, doc, query, where,
  getDocs, getDoc, setDoc, updateDoc, addDoc, orderBy, limit, serverTimestamp,
} from '../services/firebase'
import { useToast } from '../components/UI/Toast'
import Skeleton from '../components/UI/Skeleton'
import PlatformBadge from '../components/UI/PlatformBadge'
import ImageUpload from '../components/UI/ImageUpload'

// ─── Constants ────────────────────────────────────────────────────────────────

const RELATORIOS_COL     = 'relatorios_semanais'
const RELATORIOS_PDF_COL = 'relatorios'
const SEM_GESTOR_KEY      = '__sem_gestor__'

const DIAS = [
  { key: 'segunda', label: 'Segunda', offset: 0 },
  { key: 'terca',   label: 'Terça',   offset: 1 },
  { key: 'quarta',  label: 'Quarta',  offset: 2 },
  { key: 'quinta',  label: 'Quinta',  offset: 3 },
  { key: 'sexta',   label: 'Sexta',   offset: 4 },
  { key: 'sabado',  label: 'Sábado',  offset: 5 },
]

const PRINT_LABELS = { desempenho: 'Print Desempenho', operacao: 'Print Operação', financeiro: 'Print Financeiro' }

// Leitura automática de prints — cada print cobre um grupo de campos, só é
// enviado ao Gemini se pelo menos um campo do seu grupo ainda estiver vazio.
const CAMPOS_POR_PRINT = {
  desempenho: ['faturamento', 'variacao', 'ticketMedio', 'clientesNovos', 'totalVendas'],
  financeiro: ['faturamento', 'variacao'],
  operacao:   ['cancelamento', 'chamados', 'tempoAberto'],
}

// Rótulo usado no indicador "Lendo X... (i/3)" durante a extração sequencial.
const LEITURA_LABELS = { desempenho: 'desempenho', financeiro: 'financeiro', operacao: 'operação' }

// Tier gratuito do Gemini tem limite de 5 requisições/minuto — processar os
// prints em sequência (não em paralelo) com esse intervalo entre eles evita
// estourar a cota.
const DELAY_ENTRE_PRINTS_MS = 15000

// ─── Utilities ────────────────────────────────────────────────────────────────

function getISOWeekStr(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getWeekRange(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekPart)
  const jan4    = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day)
  const monday = new Date(week1Mon)
  monday.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7)
  return monday
}

function formatWeekOption(weekStr) {
  const weekNum = parseInt(weekStr.split('-W')[1])
  const mon = getWeekRange(weekStr)
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  const fmt = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `Semana ${weekNum} — ${fmt(mon)} a ${fmt(sun)}`
}

// "06/07 - 12/07/2026" — usado no cabeçalho do PDF
function formatPeriodoPDF(weekStr) {
  const mon = getWeekRange(weekStr)
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  const fmt = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${fmt(mon)} - ${fmt(sun)}/${sun.getUTCFullYear()}`
}

function generateWeekOptions() {
  const now = new Date()
  const dow = (now.getUTCDay() + 6) % 7
  const thisMon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow))
  const opts = []
  for (let i = -1; i <= 25; i++) {
    const mon = new Date(thisMon)
    mon.setUTCDate(thisMon.getUTCDate() - i * 7)
    opts.push({ value: getISOWeekStr(mon), label: formatWeekOption(getISOWeekStr(mon)) })
  }
  return opts
}

function formatDatetimeDisplay(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayISOOffset() { return (new Date().getDay() + 6) % 7 }

// A semana de referência pra lançamento de resultados/relatórios é SEMPRE a
// semana anterior completa à data atual (segunda a domingo) — nunca a semana
// em andamento, já que os números só fecham depois que a semana termina.
function getSemanaAnteriorAtual() { return getPreviousWeek(getISOWeekStr()) }

// Status de cada loja no calendário: derivado automaticamente da existência
// de documentos em `resultados`/`relatorios` para a semana anterior atual —
// não depende mais de um toggle manual.
function computeLojaStatus(diaOffset, todayOffset, temResultado, enviado, temRelatorio) {
  if (enviado) return { type: 'enviado' }
  if (temResultado && temRelatorio) return { type: 'completo' }
  if (temResultado) return { type: 'resultado' }
  if (temRelatorio) return { type: 'relatorio' }
  if (diaOffset != null && diaOffset < todayOffset) return { type: 'pendente' }
  return { type: 'no_prazo' }
}

function plataformasDeLoja(loja) {
  return loja.plataformas?.length ? loja.plataformas : (loja.plataforma ? [loja.plataforma] : [])
}

// Status agregado para lojas com múltiplas plataformas: cada plataforma tem
// seu próprio resultado por semana; só fica "completo"/"enviado" quando
// TODAS as plataformas têm lançamento — senão fica "parcial".
function computeLojaStatusMultiplataforma(diaOffset, todayOffset, plataformas, resPorPlataforma) {
  const detalhes = plataformas.map(p => {
    const info = resPorPlataforma[p]
    return { plataforma: p, existe: !!info, enviado: !!info?.enviado }
  })
  const totalOk = detalhes.filter(d => d.existe).length

  let type
  if (totalOk === 0) {
    type = (diaOffset != null && diaOffset < todayOffset) ? 'pendente' : 'no_prazo'
  } else if (totalOk < plataformas.length) {
    type = 'parcial'
  } else if (detalhes.every(d => d.enviado)) {
    type = 'enviado'
  } else {
    type = 'completo'
  }

  return { type, detalhes }
}

function getPreviousWeek(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekPart)
  if (week === 1) return getISOWeekStr(new Date(Date.UTC(year - 1, 11, 28)))
  return `${year}-W${String(week - 1).padStart(2, '0')}`
}

async function urlParaDataURL(url) {
  console.log('[urlParaDataURL] buscando:', url)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar ${url}`)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onloadend = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

// ─── Resumo IA via Firebase Function (Gemini Vision) ───────────────────────────

const gerarResumoRelatorio = httpsCallable(functions, 'gerarResumoRelatorio')
const extrairPrintIndividual = httpsCallable(functions, 'extrairPrintIndividual')

// ─── PDF generator (jsPDF native — sem html2canvas para conteúdo estruturado) ──

async function generatePDF({ nomeLoja, semanaLabel, periodoLabel, faturamento, variacao, cancelamento, chamados, tempoAberto, resumoIA, prints = {} }) {
  // Carrega logo como base64
  let logoB64 = null
  try {
    logoB64 = await urlParaDataURL(window.location.origin + '/logo.png')
  } catch {}

  const RED   = [229, 50, 45]
  const BLACK = [20, 20, 20]
  const GRAY  = [130, 130, 130]
  const GREEN = [22, 163, 74]
  const DKRED = [239, 68, 68]
  const LGRAY = [220, 220, 220]
  const WHITE = [255, 255, 255]

  // ── PÁGINA 1: CAPA (A4 landscape 297×210mm) ────────────────────────
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const CW = pdf.internal.pageSize.getWidth()   // 297
  const CH = pdf.internal.pageSize.getHeight()  // 210

  pdf.setFillColor(...WHITE); pdf.rect(0, 0, CW, CH, 'F')

  pdf.setFillColor(...RED)
  pdf.rect(0, 0, CW, 3, 'F')          // barra topo
  pdf.rect(0, CH - 3, CW, 3, 'F')     // barra rodapé

  // Bloco vermelho esquerdo (40% × 44%)
  const blkW = CW * 0.40
  const blkH = CH * 0.44
  pdf.setFillColor(...RED); pdf.rect(0, 3, blkW, blkH, 'F')

  // "RELATORIO SEMANAL" em branco bold no bloco
  pdf.setTextColor(...WHITE); pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(30)
  const blkCX = blkW / 2
  const blkCY = 3 + blkH / 2
  pdf.text('RELATORIO', blkCX, blkCY - 9, { align: 'center' })
  pdf.text('SEMANAL',   blkCX, blkCY + 9, { align: 'center' })

  // Nome da loja abaixo do bloco
  pdf.setTextColor(...BLACK); pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(18)
  const nameLines = pdf.splitTextToSize(nomeLoja, blkW - 16)
  const nameY = 3 + blkH + 16
  pdf.text(nameLines, blkCX, nameY, { align: 'center' })

  // Período da semana abaixo do nome da loja
  if (periodoLabel) {
    pdf.setTextColor(...GRAY); pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(11)
    const periodoY = nameY + (nameLines.length * 7) + 4
    pdf.text(`Relatório Semanal | ${periodoLabel}`, blkCX, periodoY, { align: 'center' })
  }

  // Logo na área direita, centralizada verticalmente
  if (logoB64) {
    const logoMM = 52
    const rX = blkW + (CW - blkW - logoMM) / 2
    const rY = (CH - logoMM) / 2
    try { pdf.addImage(logoB64, 'PNG', rX, rY, logoMM, logoMM) } catch {}
  }

  // Crédito no rodapé
  pdf.setTextColor(...BLACK); pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text('Eric Rodrigues Roza | Gestor e Mentor iFood  @eric.ifood', CW / 2, CH - 5.5, { align: 'center' })

  // ── PÁGINA 2: PRINTS (portrait, só se houver — sem texto, apenas imagens) ───
  const printKeys = ['desempenho', 'operacao', 'financeiro']
  console.log('[generatePDF] prints recebidos:', printKeys.map(k => `${k}=${prints[k] ? (prints[k].startsWith('data:') ? 'dataURL local' : prints[k]) : 'vazio'}`))

  const printEntries = printKeys.filter(k => prints[k])
  const printsComErro = []

  if (printEntries.length > 0) {
    pdf.addPage('a4', 'portrait')
    const PW = pdf.internal.pageSize.getWidth()   // 210
    const PH = pdf.internal.pageSize.getHeight()  // 297

    pdf.setFillColor(...WHITE); pdf.rect(0, 0, PW, PH, 'F')

    const PM  = 8          // margem ~20px
    const SEP = 5          // zona do separador (linha + espaço)
    const availH = PH - PM * 2 - (printEntries.length - 1) * SEP
    const maxImgH = availH / printEntries.length
    const maxImgW = PW - PM * 2

    let py = PM

    for (let i = 0; i < printEntries.length; i++) {
      const key = printEntries[i]
      const origem = prints[key]

      // Se já é um dataURL local (print recém-selecionado) usa direto — só faz
      // fetch quando for mesmo uma URL do Storage (ex: reabrindo um relatório salvo).
      let dataUrl
      try {
        dataUrl = origem.startsWith('data:') ? origem : await urlParaDataURL(origem)
        console.log(`[generatePDF] print "${key}" carregado com sucesso (${dataUrl.length} bytes em base64)`)
      } catch (err) {
        console.error(`[generatePDF] falha ao carregar print "${key}" a partir de`, origem, err)
        printsComErro.push(key)
        continue
      }

      let imgProps
      try {
        imgProps = pdf.getImageProperties(dataUrl)
      } catch (err) {
        console.error(`[generatePDF] falha ao ler propriedades da imagem "${key}":`, err)
        printsComErro.push(key)
        continue
      }

      // Mantém proporção, ocupa o máximo de espaço disponível
      let iw = maxImgW
      let ih = (imgProps.height * maxImgW) / imgProps.width
      if (ih > maxImgH) { ih = maxImgH; iw = (imgProps.width * ih) / imgProps.height }

      const ix  = PM + (maxImgW - iw) / 2
      const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      try {
        pdf.addImage(dataUrl, fmt, ix, py, iw, ih)
        console.log(`[generatePDF] print "${key}" adicionado ao PDF (${fmt}, ${iw.toFixed(0)}x${ih.toFixed(0)}mm)`)
      } catch (err) {
        console.error(`[generatePDF] falha ao adicionar print "${key}" ao PDF:`, err)
        printsComErro.push(key)
        continue
      }
      py += ih

      // Linha separadora fina entre prints (não após o último)
      if (i < printEntries.length - 1) {
        const sepY = py + SEP / 2
        pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.3)
        pdf.line(PM, sepY, PW - PM, sepY)
        py += SEP
      }
    }
  }

  // ── PÁGINA 3: ENCERRAMENTO (portrait) ────────────────────────────
  pdf.addPage('a4', 'portrait')
  const PW = pdf.internal.pageSize.getWidth()
  const PH = pdf.internal.pageSize.getHeight()
  pdf.setFillColor(...WHITE); pdf.rect(0, 0, PW, PH, 'F')
  pdf.setFillColor(...RED); pdf.rect(0, 0, PW, 3, 'F'); pdf.rect(0, PH - 3, PW, 3, 'F')

  let ey = PH * 0.33

  pdf.setTextColor(...RED); pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(20)
  pdf.text('QUE VENHA MAIS UMA SEMANA!', PW / 2, ey, { align: 'center' }); ey += 14

  pdf.setTextColor(...BLACK); pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(13)
  for (const line of ['MUITAS VENDAS', 'PEDIDOS CONCLUIDOS SEM ATRASOS', 'AVALIACOES POSITIVAS', 'E MUITO LUCRO!!']) {
    pdf.text(`> ${line}`, PW / 2, ey, { align: 'center' }); ey += 9
  }
  ey += 8

  pdf.setTextColor(...RED); pdf.setFont('Helvetica', 'bold'); pdf.setFontSize(16)
  pdf.text('CONTE COMIGO!', PW / 2, ey, { align: 'center' }); ey += 14

  if (logoB64) {
    const lmm = 32
    try { pdf.addImage(logoB64, 'PNG', PW / 2 - lmm / 2, ey, lmm, lmm) } catch {}
    ey += lmm + 8
  }

  pdf.setTextColor(...GRAY); pdf.setFont('Helvetica', 'normal'); pdf.setFontSize(10)
  pdf.text('@eric.ifood', PW / 2, ey, { align: 'center' })

  if (printsComErro.length > 0) {
    console.error('[generatePDF] prints que falharam e ficaram de fora do PDF:', printsComErro)
  }

  return { pdf, printsComErro }
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
}

const overlayV = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
}

const modalV = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.1 } },
}

const lightboxV = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
}

// ─── Lightbox ───────────────────────────────────────────────────────────────
// Visualização fullscreen de um print — usado nos previews da seção de
// Desempenho da Semana. Renderizado via portal pra ficar acima do modal.

function Lightbox({ src, onClose }) {
  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', zIndex: 200 }}
      variants={overlayV} initial="initial" animate="animate" exit="exit"
      onMouseDown={onClose}
    >
      <motion.img
        src={src}
        alt="Print ampliado"
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
        variants={lightboxV}
        onMouseDown={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        style={{ position: 'fixed', top: '20px', right: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', color: '#fff', transition: 'background-color 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)' }}
      >
        <XIcon size={20} strokeWidth={1.75} />
      </button>
    </motion.div>,
    document.body
  )
}

// ─── ReportStatusBadge ────────────────────────────────────────────────────────

function ReportStatusBadge({ type }) {
  const base = { fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }
  if (type === 'enviado')   return <span style={{ ...base, color: '#FFFFFF', backgroundColor: '#16A34A', border: '1px solid #16A34A' }}><Check size={9} strokeWidth={2.5}/>ENVIADO</span>
  if (type === 'completo')  return <span style={{ ...base, color: '#FFFFFF', backgroundColor: '#15803D', border: '1px solid #15803D' }}><Check size={9} strokeWidth={2.5}/>Completo</span>
  if (type === 'parcial')   return <span style={{ ...base, color: '#92400E', backgroundColor: 'rgba(202,138,4,0.14)', border: '1px solid rgba(202,138,4,0.3)' }}>PARCIAL</span>
  if (type === 'relatorio') return <span style={{ ...base, color: '#16A34A', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}><Check size={9} strokeWidth={2.5}/>Relatório</span>
  if (type === 'resultado') return <span style={{ ...base, color: '#2563EB', backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}><Check size={9} strokeWidth={2.5}/>Resultado</span>
  if (type === 'no_prazo')  return <span style={{ ...base, color: '#CA8A04', backgroundColor: 'rgba(202,138,4,0.1)', border: '1px solid rgba(202,138,4,0.2)' }}>NO PRAZO</span>
  if (type === 'pendente')  return <span style={{ ...base, color: '#FFFFFF', backgroundColor: '#DC2626', border: '1px solid #DC2626' }}><AlertTriangle size={9} strokeWidth={2}/>PENDENTE</span>
  return null
}

// ─── Shared form helpers (module-level — não podem ficar dentro de componentes) ─

const INPUT_STYLE = {
  background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '5px',
  height: '32px', fontSize: '13px', color: '#111111', padding: '0 10px',
  fontFamily: "'Segoe UI', system-ui, sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box',
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', color: '#666666', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function SectionTitle({ label }) {
  return (
    <div style={{ marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #F3F3F3' }}>
      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#999999', margin: 0 }}>{label}</p>
    </div>
  )
}

function WarnBadge({ val, threshold }) {
  const n = parseFloat(val)
  if (isNaN(n) || n <= threshold) return null
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
      ATENÇÃO
    </span>
  )
}

// Label de print + indicador de status da extração individual: sem indicador
// (aguardando), spinner (processando) ou ✓ verde (concluído) — espelha o label
// interno do ImageUpload (que fica suprimido quando usado aqui).
function PrintLabelComStatus({ label, status }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
      <p style={{ fontSize: '11px', color: '#999999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
        {label}
      </p>
      {status === 'processando' && <Loader2 size={11} className="animate-spin" style={{ color: '#999999', flexShrink: 0 }} />}
      {status === 'ok' && <Check size={11} strokeWidth={2.5} style={{ color: '#16A34A', flexShrink: 0 }} />}
      {status === 'erro' && <span style={{ fontSize: '10px', color: '#DC2626', flexShrink: 0 }}>falhou</span>}
    </div>
  )
}

// ─── HistoricoLista ───────────────────────────────────────────────────────────

function HistoricoLista({ itens, loadingHistDoc, onDownload }) {
  if (itens.length === 0) {
    return <p style={{ fontSize: '12px', color: '#999999', margin: 0 }}>Nenhum lançamento para esta loja.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {itens.map(item => (
        <div key={`${item.tipo}_${item.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F3F3' }}>
          <div>
            <p style={{ fontSize: '12px', color: '#111111', margin: 0, fontWeight: 500 }}>
              {formatWeekOption(item.semana)}
              <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: item.tipo === 'resultado' ? '#2563EB' : '#16A34A' }}>
                {item.tipo === 'resultado' ? 'Resultado' : 'Relatório'}
              </span>
            </p>
            <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {item.tipo === 'resultado'
                ? `R$ ${Number(item.faturamento ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : (item.timestamp ? formatDatetimeDisplay(item.timestamp) : '—')}
            </p>
          </div>
          {item.tipo === 'relatorio' && (
            <button
              onClick={() => onDownload(item)}
              disabled={loadingHistDoc === item.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555', background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '4px', padding: '4px 10px', cursor: loadingHistDoc === item.id ? 'not-allowed' : 'pointer', transition: 'color 150ms, border-color 150ms' }}
              onMouseEnter={e => { if (!loadingHistDoc) { e.currentTarget.style.color = '#111111'; e.currentTarget.style.borderColor = '#DDDDDD' } }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#E8E8E8' }}
            >
              {loadingHistDoc === item.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11}/>}
              Baixar novamente
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── LojaModal ────────────────────────────────────────────────────────────────

function LojaModal({ loja, onClose, onSaved, onMarcarEnvio }) {
  const toast = useToast()
  const { user, isSuperAdmin } = useAuth()
  const { modoTesteAtivo, organizacaoIdsPermitidos } = useModoTeste()
  const escopoOrgModal = modoTesteAtivo
    ? [where('organizacaoId', 'in', organizacaoIdsPermitidos.slice(0, 10))]
    : isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]

  // ─ Lojas com mais de uma plataforma exigem escolher qual plataforma será
  // lançada antes de mostrar o formulário — cada plataforma tem seu próprio
  // documento de resultado (`${lojaId}_${plataforma}_${semana}`).
  const plataformasLoja = useMemo(
    () => loja.plataformas?.length ? loja.plataformas : (loja.plataforma ? [loja.plataforma] : []),
    [loja]
  )
  const multiplasPlataformas = plataformasLoja.length > 1
  const [plataformaSelecionada, setPlataformaSelecionada] = useState(
    () => multiplasPlataformas ? null : (plataformasLoja[0] ?? null)
  )

  function resultadoDocId(semana) {
    return multiplasPlataformas ? `${loja.id}_${plataformaSelecionada}_${semana}` : `${loja.id}_${semana}`
  }

  function storagePath(pasta, tipo) {
    return multiplasPlataformas
      ? `${pasta}/${loja.id}/${plataformaSelecionada}/${semanaRef}/${tipo}.jpg`
      : `${pasta}/${loja.id}/${semanaRef}/${tipo}.jpg`
  }

  // ─ Semana de referência do modal — sempre a semana anterior à atual por
  // padrão (os números só fecham depois que a semana termina), mas o gestor
  // pode trocar manualmente se precisar lançar dados de outra semana.
  const weekOptions = useMemo(() => generateWeekOptions(), [])
  const [semanaRef, setSemanaRef] = useState(() => getSemanaAnteriorAtual())

  // ─ Seção 1: Desempenho da Semana
  const [faturamento,         setFaturamento]         = useState('')
  const [variacao,            setVariacao]            = useState('')
  const [ticketMedio,         setTicketMedio]         = useState('')
  const [clientesNovos,       setClientesNovos]       = useState('')
  const [totalVendas,         setTotalVendas]         = useState('')
  const [observacoes,         setObservacoes]         = useState('')
  const [printDesempenho,     setPrintDesempenho]     = useState(null)
  const [printFinanceiro,     setPrintFinanceiro]     = useState(null)
  const [resultadoSalvo,      setResultadoSalvo]      = useState(false)
  const [loadingEnviar,       setLoadingEnviar]       = useState(false)

  // ─ Seção 2: Relatório PDF
  const [cancelamento,   setCancelamento]   = useState('')
  const [chamados,       setChamados]       = useState('')
  const [tempoAberto,    setTempoAberto]    = useState('')
  const [contexto,       setContexto]       = useState('')
  const [printOperacao,  setPrintOperacao]  = useState(null)
  const [resumoIA,       setResumoIA]       = useState('')
  const [loadingIA,      setLoadingIA]      = useState(false)
  const [copiado,        setCopiado]        = useState(false)
  const [loadingPDF,     setLoadingPDF]     = useState(false)

  // ─ Preenchimento automático via Gemini Vision. `camposAuto` marca quais
  // campos foram lidos dos prints (borda verde).
  const [loadingExtracao, setLoadingExtracao] = useState(false)
  const [camposAuto, setCamposAuto] = useState({})
  // `statusExtracao` acompanha cada print individualmente. Os prints são
  // processados em SEQUÊNCIA (não em paralelo) com um delay entre cada um,
  // pra não estourar o limite gratuito de 5 requisições/minuto do Gemini.
  const [statusExtracao,  setStatusExtracao]  = useState({ desempenho: null, financeiro: null, operacao: null })
  // `printAtual` alimenta o indicador "Lendo X... (i/3)" durante a extração.
  const [printAtual,      setPrintAtual]      = useState(null)

  // ─ Lightbox — imagem do print em tela cheia
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // ─ Auto-save com debounce — `carregandoDadosRef` evita que o efeito dispare
  // durante o `fetchDados()` (que zera os campos antes de repopular do
  // Firestore); sem essa guarda, a troca de semana/plataforma acionaria um
  // save automático com os campos vazios por uma fração de segundo.
  const carregandoDadosRef = useRef(false)
  const autoSaveTimerRef   = useRef(null)

  // ─ Histórico — para lojas com múltiplas plataformas, um array por plataforma;
  // para lojas de plataforma única, um array simples (mantém o formato antigo).
  const [historico,        setHistorico]        = useState(() => multiplasPlataformas ? {} : [])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [loadingHistDoc,   setLoadingHistDoc]   = useState(null)

  // ─ Histórico é fixo à loja (não depende da semana selecionada)
  useEffect(() => {
    fetchHistorico()
  }, []) // eslint-disable-line

  // ─ Dados da seção 1/2 são recarregados sempre que a semana ou a plataforma
  // selecionada mudam — só roda depois que a plataforma foi escolhida.
  useEffect(() => {
    if (multiplasPlataformas && !plataformaSelecionada) return
    fetchDados()
  }, [semanaRef, plataformaSelecionada]) // eslint-disable-line

  async function fetchDados() {
    carregandoDadosRef.current = true
    setFaturamento(''); setVariacao(''); setObservacoes('')
    setTicketMedio(''); setClientesNovos(''); setTotalVendas('')
    setPrintDesempenho(null); setPrintFinanceiro(null); setPrintOperacao(null); setResultadoSalvo(false)
    setCancelamento(''); setChamados(''); setTempoAberto(''); setContexto('')
    setResumoIA(''); setCamposAuto({})
    setStatusExtracao({ desempenho: null, financeiro: null, operacao: null })

    try {
      const prevWeek = getPreviousWeek(semanaRef)
      const pdfConstraints = [...escopoOrgModal, where('lojaId', '==', loja.id), where('semana', '==', semanaRef)]
      if (multiplasPlataformas) pdfConstraints.push(where('plataforma', '==', plataformaSelecionada))

      const [resSnap, prevSnap, pdfSnap] = await Promise.all([
        getDoc(doc(db, COLLECTIONS.RESULTADOS, resultadoDocId(semanaRef))),
        getDoc(doc(db, COLLECTIONS.RESULTADOS, resultadoDocId(prevWeek))),
        getDocs(query(collection(db, RELATORIOS_PDF_COL), ...pdfConstraints)),
      ])

      const resData = resSnap.exists() ? resSnap.data() : null
      const relData = !pdfSnap.empty ? pdfSnap.docs[0].data() : null

      const currFat = resData ? (resData.faturamento?.toString() ?? '') : ''
      setFaturamento(currFat)
      setVariacao(resData?.variacao?.toString() ?? '')
      setObservacoes(resData?.observacoes ?? '')
      setTicketMedio((resData?.ticketMedio ?? relData?.ticketMedio)?.toString() ?? '')
      setClientesNovos((resData?.clientesNovos ?? relData?.clientesNovos)?.toString() ?? '')
      setTotalVendas((resData?.totalVendas ?? relData?.totalVendas)?.toString() ?? '')
      setCancelamento((resData?.cancelamento ?? relData?.cancelamento)?.toString() ?? '')
      setChamados((resData?.chamados ?? relData?.chamados)?.toString() ?? '')
      setTempoAberto((resData?.tempoAberto ?? relData?.tempoAberto)?.toString() ?? '')
      setContexto(resData?.contexto ?? relData?.contexto ?? '')
      setResumoIA(relData?.textoResumo ?? '')
      if (resData) setResultadoSalvo(true)

      const prints = resData?.prints ?? relData?.prints ?? {}
      if (prints.desempenho) setPrintDesempenho({ dataUrl: prints.desempenho })
      if (prints.financeiro) setPrintFinanceiro({ dataUrl: prints.financeiro })
      if (prints.operacao)   setPrintOperacao({ dataUrl: prints.operacao })

      if (prevSnap.exists()) {
        const prevFat = prevSnap.data().faturamento?.toString() ?? ''
        // Auto-calcula variação se o resultado atual existe mas variação não foi definida
        if (currFat && prevFat && resData && !resData.variacao) {
          const curr = parseFloat(currFat)
          const prev = parseFloat(prevFat)
          if (prev > 0) setVariacao((((curr - prev) / prev) * 100).toFixed(1))
        }
      }
    } catch (err) {
      console.error('[LojaModal] fetchDados:', err)
    } finally {
      // Só libera o auto-save depois que os campos terminaram de ser
      // repopulados — evita salvar os valores vazios do reset acima.
      carregandoDadosRef.current = false
    }
  }

  // ─ Auto-save com debounce — dispara ~1.5s depois da última mudança em
  // qualquer um dos campos abaixo. Aborta silenciosamente (com log) se a
  // loja/semana/plataforma ainda não estiverem definidas, ou se `fetchDados`
  // estiver no meio de um reload (ver `carregandoDadosRef` acima).
  useEffect(() => {
    if (carregandoDadosRef.current) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSalvarResultado()
    }, 1500)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    faturamento, variacao, cancelamento, chamados, tempoAberto,
    ticketMedio, clientesNovos, totalVendas, contexto,
  ])

  async function autoSalvarResultado() {
    if (!loja?.id || !semanaRef || (multiplasPlataformas && !plataformaSelecionada)) {
      console.log('[autoSave] abortado — loja/semana/plataforma ainda não definidos:', {
        lojaId: loja?.id, semanaRef, plataformaSelecionada, multiplasPlataformas,
      })
      return
    }

    const docId = resultadoDocId(semanaRef)
    const payload = {
      lojaId:        loja.id,
      gestorId:      loja.gestorId,
      organizacaoId: loja.organizacaoId ?? user.organizacaoId ?? null,
      plataforma:    plataformaSelecionada,
      semana:        semanaRef,
      faturamento:   parseFloat(faturamento)   || 0,
      variacao:      parseFloat(variacao)      || 0,
      ticketMedio:   parseFloat(ticketMedio)   || 0,
      clientesNovos: parseInt(clientesNovos)   || 0,
      totalVendas:   parseInt(totalVendas)     || 0,
      cancelamento:  parseFloat(cancelamento)  || 0,
      chamados:      parseFloat(chamados)      || 0,
      tempoAberto:   parseFloat(tempoAberto)   || 0,
      contexto:      contexto.trim(),
      atualizadoEm:  new Date().toISOString(),
    }

    console.log('[autoSave] salvando resultado — docId:', docId, 'payload:', payload)

    try {
      const jaExistia = resultadoSalvo
      const resultadoRef = doc(db, COLLECTIONS.RESULTADOS, docId)
      await setDoc(resultadoRef, jaExistia ? payload : { ...payload, criadoEm: new Date().toISOString() }, { merge: true })
      if (!jaExistia) setResultadoSalvo(true)
      console.log('[autoSave] salvo com sucesso — docId:', docId)
    } catch (err) {
      console.error('[autoSave] erro ao salvar:', docId, err)
    }
  }

  async function fetchHistorico() {
    setLoadingHistorico(true)
    try {
      const [resSnap, relSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.RESULTADOS), ...escopoOrgModal, where('lojaId', '==', loja.id), orderBy('semana', 'desc'), limit(multiplasPlataformas ? 20 : 5))),
        getDocs(query(collection(db, RELATORIOS_PDF_COL), ...escopoOrgModal, where('lojaId', '==', loja.id), orderBy('timestamp', 'desc'), limit(multiplasPlataformas ? 20 : 5))),
      ])
      const resItens = resSnap.docs.map(d => ({ id: d.id, tipo: 'resultado', ...d.data() }))
      const relItens = relSnap.docs.map(d => ({ id: d.id, tipo: 'relatorio', ...d.data() }))
      const combinado = [...resItens, ...relItens].sort((a, b) => {
        if (a.semana !== b.semana) return a.semana < b.semana ? 1 : -1
        const ta = a.tipo === 'resultado' ? (a.criadoEm || '') : (a.timestamp || '')
        const tb = b.tipo === 'resultado' ? (b.criadoEm || '') : (b.timestamp || '')
        return ta < tb ? 1 : -1
      })

      if (multiplasPlataformas) {
        const grupos = {}
        plataformasLoja.forEach(p => { grupos[p] = [] })
        combinado.forEach(item => {
          const p = item.plataforma || plataformasLoja[0]
          if (!grupos[p]) grupos[p] = []
          if (grupos[p].length < 4) grupos[p].push(item)
        })
        setHistorico(grupos)
      } else {
        setHistorico(combinado.slice(0, 6))
      }
    } catch (err) {
      console.error('[LojaModal] fetchHistorico:', err)
    } finally {
      setLoadingHistorico(false)
    }
  }

  // ─ Print handlers

  // Validação de tamanho/tipo já é feita pelo <ImageUpload> antes de chamar
  // onChange — aqui só converte o File validado em dataURL pro preview local
  // (e pro jsPDF, que precisa de uma dataURL síncrona, não de uma blob URL).
  function handlePrintFile(setter, file) {
    const reader = new FileReader()
    reader.onload = e => setter({ file, dataUrl: e.target.result })
    reader.readAsDataURL(file)
  }

  async function resolvePrintUrl(val, caminho) {
    if (val?.file) return await uploadImagem(val.file, caminho)
    return val?.dataUrl ?? null
  }

  // Se o gestor preencheu observações ao salvar (Enviar Dados ou Gerar PDF),
  // registra automaticamente uma ação na aba Ações do Atividades — se já havia
  // uma ação de relatório semanal para essa mesma loja+semana+plataforma,
  // atualiza em vez de duplicar. Não deve quebrar o fluxo principal se falhar.
  async function registrarAcaoObservacao() {
    const texto = observacoes.trim()
    if (!texto) return
    try {
      const semanaLabel = formatWeekOption(semanaRef)
      const payload = {
        lojaId:        loja.id,
        lojaName:      loja.nome,
        gestorId:      user?.uid ?? loja.gestorId ?? null,
        gestorNome:    user?.nome ?? '',
        organizacaoId: loja.organizacaoId ?? user?.organizacaoId ?? null,
        descricao:     texto,
        semana:        semanaLabel,
        plataforma:    plataformaSelecionada,
        origem:        'relatorio_semanal',
      }

      const existenteSnap = await getDocs(query(
        collection(db, COLLECTIONS.ACOES),
        ...escopoOrgModal,
        where('lojaId', '==', loja.id),
        where('semana', '==', semanaLabel),
        where('plataforma', '==', plataformaSelecionada),
        where('origem', '==', 'relatorio_semanal'),
      ))

      if (!existenteSnap.empty) {
        await updateDoc(doc(db, COLLECTIONS.ACOES, existenteSnap.docs[0].id), { ...payload, timestamp: serverTimestamp() })
      } else {
        await addDoc(collection(db, COLLECTIONS.ACOES), { ...payload, timestamp: serverTimestamp() })
      }
    } catch (err) {
      console.error('[ControleSemanal] registrarAcaoObservacao:', err)
    }
  }

  // ─ Enviar Dados — salva tudo na coleção `resultados` e marca a loja como
  // enviada no calendário, sem gerar PDF nem chamar o resumo local.

  async function handleEnviarDados() {
    if (!faturamento) { toast('Informe o faturamento bruto da semana.', 'error'); return }
    setLoadingEnviar(true)
    try {
      const [urlDesempenho, urlFinanceiro, urlOperacao] = await Promise.all([
        resolvePrintUrl(printDesempenho, storagePath('resultados', 'desempenho')),
        resolvePrintUrl(printFinanceiro, storagePath('resultados', 'financeiro')),
        resolvePrintUrl(printOperacao,   storagePath('resultados', 'operacao')),
      ])

      const monday = getWeekRange(semanaRef)
      const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6)
      const agora  = new Date().toISOString()
      const jaExistia = resultadoSalvo

      const payload = {
        lojaId:           loja.id,
        gestorId:         loja.gestorId,
        organizacaoId:    loja.organizacaoId ?? user?.organizacaoId ?? null,
        plataforma:       plataformaSelecionada,
        semana:           semanaRef,
        dataInicio:       monday.toISOString(),
        dataFim:          sunday.toISOString(),
        faturamento:      parseFloat(faturamento)   || 0,
        variacao:         parseFloat(variacao)      || 0,
        ticketMedio:      parseFloat(ticketMedio)   || 0,
        clientesNovos:    parseInt(clientesNovos)   || 0,
        totalVendas:      parseInt(totalVendas)     || 0,
        cancelamento:     parseFloat(cancelamento)  || 0,
        chamados:         parseFloat(chamados)      || 0,
        tempoAberto:      parseFloat(tempoAberto)   || 0,
        observacoes:      observacoes.trim(),
        contexto:         contexto.trim(),
        prints:           { desempenho: urlDesempenho, financeiro: urlFinanceiro, operacao: urlOperacao },
        relatorioEnviado: true,
        dataEnvio:        agora,
      }

      const resultadoRef = doc(db, COLLECTIONS.RESULTADOS, resultadoDocId(semanaRef))
      if (jaExistia) {
        await updateDoc(resultadoRef, payload)
      } else {
        await setDoc(resultadoRef, { ...payload, criadoEm: agora }, { merge: true })
      }

      await onMarcarEnvio?.(loja, semanaRef, agora)
      await registrarAcaoObservacao()

      setResultadoSalvo(true)
      toast(jaExistia ? 'Dados atualizados!' : 'Dados enviados com sucesso!', 'success')
      fetchHistorico()
      onSaved?.()
    } catch (err) {
      console.error('[handleEnviarDados]', err)
      toast('Erro ao enviar dados: ' + err.message, 'error')
    } finally {
      setLoadingEnviar(false)
    }
  }

  // ─ Extração automática dos prints (Gemini Vision). Processa os prints
  // necessários em SEQUÊNCIA (um await por vez, nunca Promise.all) com um
  // delay de 15s entre cada chamada — o tier gratuito do Gemini permite só 5
  // requisições/minuto, e 3 chamadas em paralelo estourariam essa cota. Só
  // preenche os campos que o Gemini conseguiu ler; o resto fica vazio para o
  // gestor completar. Se só 1 ou 2 prints estiverem anexados, processa
  // somente os que existem, sem delay depois do último.
  async function handleExtrairDados() {
    const valores = { faturamento, variacao, ticketMedio, clientesNovos, totalVendas, cancelamento, chamados, tempoAberto }
    const camposVazios = Object.keys(valores).filter(k => !valores[k]?.trim())

    if (camposVazios.length === 0) {
      toast('Todos os campos já estão preenchidos', 'warning')
      return
    }

    const printsDisponiveis = { desempenho: printDesempenho, financeiro: printFinanceiro, operacao: printOperacao }
    const tiposParaProcessar = Object.entries(CAMPOS_POR_PRINT)
      .filter(([tipo, campos]) => campos.some(c => camposVazios.includes(c)) && printsDisponiveis[tipo]?.dataUrl)
      .map(([tipo]) => tipo)

    if (tiposParaProcessar.length === 0) {
      toast('Todos os campos já estão preenchidos', 'warning')
      return
    }

    setLoadingExtracao(true)
    setStatusExtracao(prev => {
      const next = { ...prev }
      tiposParaProcessar.forEach(tipo => { next[tipo] = 'processando' })
      return next
    })

    function aplicarResultado(d) {
      const autoPreenchidos = {}
      if (d.faturamento    != null) { setFaturamento(String(d.faturamento));       autoPreenchidos.faturamento    = true }
      if (d.variacao       != null) { setVariacao(String(d.variacao));            autoPreenchidos.variacao       = true }
      if (d.ticketMedio    != null) { setTicketMedio(String(d.ticketMedio));      autoPreenchidos.ticketMedio    = true }
      if (d.clientesNovos  != null) { setClientesNovos(String(d.clientesNovos));  autoPreenchidos.clientesNovos  = true }
      if (d.totalVendas    != null) { setTotalVendas(String(d.totalVendas));      autoPreenchidos.totalVendas    = true }
      if (d.cancelamento   != null) { setCancelamento(String(d.cancelamento));    autoPreenchidos.cancelamento   = true }
      if (d.chamados       != null) { setChamados(String(d.chamados));           autoPreenchidos.chamados       = true }
      if (d.tempoLoja      != null) { setTempoAberto(String(d.tempoLoja));       autoPreenchidos.tempoAberto    = true }
      setCamposAuto(prev => ({ ...prev, ...autoPreenchidos }))
    }

    for (let i = 0; i < tiposParaProcessar.length; i++) {
      const tipo = tiposParaProcessar[i]
      setPrintAtual({ tipo, indice: i + 1, total: tiposParaProcessar.length })
      try {
        const { data } = await extrairPrintIndividual({ print: printsDisponiveis[tipo].dataUrl, tipoPrint: tipo })
        aplicarResultado(data?.dados ?? {})
        setStatusExtracao(prev => ({ ...prev, [tipo]: 'ok' }))
      } catch (err) {
        console.error(`[handleExtrairDados] ${tipo}:`, err)
        setStatusExtracao(prev => ({ ...prev, [tipo]: 'erro' }))
      }

      // Só aguarda entre um print e o próximo — não após o último.
      if (i < tiposParaProcessar.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_PRINTS_MS))
      }
    }

    setPrintAtual(null)
    setLoadingExtracao(false)
    toast('Extração concluída! Verifique os dados e corrija se necessário.', 'success')
  }

  // ─ Seção 2: IA + PDF

  async function handleGerarIA() {
    setLoadingIA(true)
    try {
      const { data } = await gerarResumoRelatorio({
        nomeLoja:       loja.nome,
        semana:         formatWeekOption(semanaRef),
        plataforma:     plataformaSelecionada,
        faturamento,
        variacao,
        cancelamento,
        chamados,
        tempoLoja:      tempoAberto,
        contextoGestor: contexto,
        prints: {
          desempenho: printDesempenho?.dataUrl ?? null,
          financeiro: printFinanceiro?.dataUrl ?? null,
          operacao:   printOperacao?.dataUrl ?? null,
        },
      })
      setResumoIA(data.resumo)
      toast('Resumo gerado!', 'success')
    } catch (err) {
      toast('Erro ao gerar resumo: ' + err.message, 'error')
    } finally {
      setLoadingIA(false)
    }
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(resumoIA)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast('Não foi possível copiar.', 'error')
    }
  }

  async function handleGerarSalvarPDF() {
    setLoadingPDF(true)
    try {
      const [urlDesempenho, urlFinanceiro, urlOperacao] = await Promise.all([
        resolvePrintUrl(printDesempenho, storagePath('resultados', 'desempenho')),
        resolvePrintUrl(printFinanceiro, storagePath('resultados', 'financeiro')),
        resolvePrintUrl(printOperacao,   storagePath('relatorios', 'operacao')),
      ])

      // O PDF em si usa os dataURLs locais (evita depender de um fetch de
      // volta pra URL do Storage, que pode falhar por CORS).
      const printDataUrls = {
        desempenho: printDesempenho?.dataUrl ?? null,
        operacao:   printOperacao?.dataUrl ?? null,
        financeiro: printFinanceiro?.dataUrl ?? null,
      }

      const semanaLabel  = formatWeekOption(semanaRef)
      const periodoLabel = formatPeriodoPDF(semanaRef)
      const pdfData = { nomeLoja: loja.nome, semanaLabel, periodoLabel, faturamento, variacao, cancelamento, chamados, tempoAberto, resumoIA }

      const { pdf, printsComErro } = await generatePDF({ ...pdfData, prints: printDataUrls })
      pdf.save(`Relatorio_${loja.nome.replace(/\s+/g, '_')}_${semanaRef}.pdf`)

      if (printsComErro.length > 0) {
        toast(`PDF gerado, mas ${printsComErro.length === 1 ? 'um print não pôde' : 'alguns prints não puderam'} ser incluído no arquivo. Veja o console para detalhes.`, 'error')
      }

      await addDoc(collection(db, RELATORIOS_PDF_COL), {
        lojaId:        loja.id,
        gestorId:      loja.gestorId,
        organizacaoId: loja.organizacaoId ?? user.organizacaoId ?? null,
        plataforma:    plataformaSelecionada,
        semana:        semanaRef,
        faturamento:   parseFloat(faturamento)  || 0,
        variacao:      parseFloat(variacao)     || 0,
        ticketMedio:   parseFloat(ticketMedio)  || 0,
        clientesNovos: parseInt(clientesNovos)  || 0,
        totalVendas:   parseInt(totalVendas)    || 0,
        cancelamento:  parseFloat(cancelamento) || 0,
        chamados:      parseFloat(chamados)     || 0,
        tempoAberto:   parseFloat(tempoAberto)  || 0,
        textoResumo:  resumoIA,
        contexto:     contexto.trim(),
        prints:       { desempenho: urlDesempenho, operacao: urlOperacao, financeiro: urlFinanceiro },
        timestamp:    new Date().toISOString(),
        status:       'gerado',
      })

      await onMarcarEnvio?.(loja, semanaRef, new Date().toISOString())
      await registrarAcaoObservacao()
      toast('PDF salvo!', 'success')
      fetchHistorico()
      onSaved?.()
    } catch (err) {
      console.error('[PDF]', err)
      toast('Erro ao gerar PDF: ' + err.message, 'error')
    } finally {
      setLoadingPDF(false)
    }
  }

  // ─ Download histórico

  async function handleDownloadHistorico(rel) {
    setLoadingHistDoc(rel.id)
    try {
      const semanaLabel  = formatWeekOption(rel.semana)
      const periodoLabel = formatPeriodoPDF(rel.semana)
      const pdfData = {
        nomeLoja:     loja.nome,
        semanaLabel,
        periodoLabel,
        faturamento:  rel.faturamento,
        variacao:     rel.variacao,
        cancelamento: rel.cancelamento,
        chamados:     rel.chamados,
        tempoAberto:  rel.tempoAberto,
        resumoIA:     rel.textoResumo,
      }
      const { pdf, printsComErro } = await generatePDF({ ...pdfData, prints: rel.prints || {} })
      pdf.save(`Relatorio_${loja.nome.replace(/\s+/g, '_')}_${rel.semana}.pdf`)

      if (printsComErro.length > 0) {
        toast(`PDF baixado, mas ${printsComErro.length === 1 ? 'um print não pôde' : 'alguns prints não puderam'} ser incluído no arquivo. Veja o console para detalhes.`, 'error')
      } else {
        toast('PDF baixado!', 'success')
      }
    } catch (err) {
      console.error('[handleDownloadHistorico]', err)
      toast('Erro ao baixar: ' + err.message, 'error')
    } finally {
      setLoadingHistDoc(null)
    }
  }

  // ─ Render

  return (
    <>
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:px-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      variants={overlayV} initial="initial" animate="animate" exit="exit"
      onMouseDown={onClose}
    >
      <motion.div
        className="h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-xl border-0 sm:border"
        style={{ position: 'relative', width: '100%', maxWidth: '720px', backgroundColor: '#FFFFFF', borderColor: '#E8E8E8', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}
        variants={modalV}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '22px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', margin: 0 }}>{loja.nome}</h2>
                {multiplasPlataformas && plataformaSelecionada && (
                  <>
                    <PlatformBadge plataforma={plataformaSelecionada} />
                    <button
                      type="button"
                      onClick={() => setPlataformaSelecionada(null)}
                      style={{ fontSize: '11px', color: '#999999', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      Trocar
                    </button>
                  </>
                )}
              </div>
              <select
                value={semanaRef}
                onChange={e => setSemanaRef(e.target.value)}
                className="select"
                style={{ height: '22px', fontSize: '12px', color: '#999999', padding: '0 8px', width: 'auto' }}
              >
                {weekOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <button
              onClick={onClose}
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#555', transition: 'color 150ms, background-color 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#111111' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#555' }}
            >
              <XIcon size={15} strokeWidth={1.5} />
            </button>
          </div>
          <div style={{ height: '0.5px', background: '#E8E8E8' }} />
        </div>

        {multiplasPlataformas && !plataformaSelecionada ? (
          <div style={{ padding: '28px', flex: 1 }}>
            <p style={{ fontSize: '13px', color: '#666666', marginBottom: '14px' }}>
              Esta loja tem múltiplas plataformas. Selecione qual plataforma deseja lançar:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {plataformasLoja.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlataformaSelecionada(p)}
                  style={{ background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', transition: 'border-color 150ms, background-color 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#DDDDDD'; e.currentTarget.style.backgroundColor = '#F9F9F9' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <PlatformBadge plataforma={p} />
                </button>
              ))}
            </div>
          </div>
        ) : (
        <>
        {/* Scrollable content */}
        <div style={{ padding: '0 28px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Seção 1 — Desempenho da Semana */}
            <div style={{ backgroundColor: '#F9F9F9', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '18px' }}>
              <SectionTitle label="Desempenho da Semana" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                <div>
                  <SectionTitle label="Vendas" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <Field label="Faturamento Bruto (R$)">
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.faturamento ? '#16A34A' : '#E8E8E8' }}
                          value={faturamento}
                          onChange={e => { setFaturamento(e.target.value); setCamposAuto(c => c.faturamento ? { ...c, faturamento: false } : c) }}
                          placeholder="0.00"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.faturamento ? '#16A34A' : '#E8E8E8'}
                        />
                      </Field>
                      <Field label="Variação % vs Semana Anterior">
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.variacao ? '#16A34A' : '#E8E8E8' }}
                          value={variacao}
                          onChange={e => { setVariacao(e.target.value); setCamposAuto(c => c.variacao ? { ...c, variacao: false } : c) }}
                          placeholder="-12.5 ou 8.3"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.variacao ? '#16A34A' : '#E8E8E8'}
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <Field label="Ticket Médio (R$)">
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.ticketMedio ? '#16A34A' : '#E8E8E8' }}
                          value={ticketMedio}
                          onChange={e => { setTicketMedio(e.target.value); setCamposAuto(c => c.ticketMedio ? { ...c, ticketMedio: false } : c) }}
                          placeholder="0.00"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.ticketMedio ? '#16A34A' : '#E8E8E8'}
                        />
                      </Field>
                      <Field label="Clientes Novos">
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.clientesNovos ? '#16A34A' : '#E8E8E8' }}
                          value={clientesNovos}
                          onChange={e => { setClientesNovos(e.target.value); setCamposAuto(c => c.clientesNovos ? { ...c, clientesNovos: false } : c) }}
                          placeholder="0"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.clientesNovos ? '#16A34A' : '#E8E8E8'}
                        />
                      </Field>
                      <Field label="Total de Vendas (pedidos)">
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.totalVendas ? '#16A34A' : '#E8E8E8' }}
                          value={totalVendas}
                          onChange={e => { setTotalVendas(e.target.value); setCamposAuto(c => c.totalVendas ? { ...c, totalVendas: false } : c) }}
                          placeholder="0"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.totalVendas ? '#16A34A' : '#E8E8E8'}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <Field label="Observações (opcional)">
                  <textarea
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Observações sobre o desempenho da semana..."
                    rows={2}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '5px', padding: '10px 12px', fontSize: '13px', color: '#111111', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}
                    onFocus={e => e.target.style.borderColor = '#E5322D'}
                    onBlur={e => e.target.style.borderColor = '#E8E8E8'}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <PrintLabelComStatus label={PRINT_LABELS.desempenho} status={statusExtracao.desempenho} />
                    <ImageUpload
                      value={printDesempenho?.file ?? printDesempenho?.dataUrl ?? null}
                      onChange={f => f ? handlePrintFile(setPrintDesempenho, f) : setPrintDesempenho(null)}
                      onError={msg => toast(msg, 'error')}
                      onPreviewClick={setLightboxSrc}
                    />
                  </div>
                  <div>
                    <PrintLabelComStatus label={PRINT_LABELS.financeiro} status={statusExtracao.financeiro} />
                    <ImageUpload
                      value={printFinanceiro?.file ?? printFinanceiro?.dataUrl ?? null}
                      onChange={f => f ? handlePrintFile(setPrintFinanceiro, f) : setPrintFinanceiro(null)}
                      onError={msg => toast(msg, 'error')}
                      onPreviewClick={setLightboxSrc}
                    />
                  </div>
                  <div>
                    <PrintLabelComStatus label={PRINT_LABELS.operacao} status={statusExtracao.operacao} />
                    <ImageUpload
                      value={printOperacao?.file ?? printOperacao?.dataUrl ?? null}
                      onChange={f => f ? handlePrintFile(setPrintOperacao, f) : setPrintOperacao(null)}
                      onError={msg => toast(msg, 'error')}
                      onPreviewClick={setLightboxSrc}
                    />
                  </div>
                </div>

                {(printDesempenho || printFinanceiro || printOperacao) && (
                  <button
                    type="button"
                    onClick={handleExtrairDados}
                    disabled={loadingExtracao}
                    style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: '#111111', background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '5px', cursor: loadingExtracao ? 'not-allowed' : 'pointer', opacity: loadingExtracao ? 0.6 : 1, transition: 'border-color 150ms' }}
                    onMouseEnter={e => { if (!loadingExtracao) e.currentTarget.style.borderColor = '#DDDDDD' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8' }}
                  >
                    {loadingExtracao
                      ? <><Loader2 size={13} className="animate-spin" /> {printAtual ? `Lendo ${LEITURA_LABELS[printAtual.tipo]}... (${printAtual.indice}/${printAtual.total})` : 'Lendo prints...'}</>
                      : <><Sparkles size={13} strokeWidth={1.75} /> Preencher automaticamente</>}
                  </button>
                )}

                {/* Separador sutil entre Vendas e Indicadores Operacionais */}
                <div style={{ height: '1px', background: '#F0F0F0' }} />

                <div>
                  <SectionTitle label="Indicadores Operacionais" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <Field label="Cancelamento (%)">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.cancelamento ? '#16A34A' : '#E8E8E8' }}
                          value={cancelamento}
                          onChange={e => { setCancelamento(e.target.value); setCamposAuto(c => c.cancelamento ? { ...c, cancelamento: false } : c) }}
                          placeholder="0.0"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.cancelamento ? '#16A34A' : '#E8E8E8'}
                        />
                        <WarnBadge val={cancelamento} threshold={1} />
                      </div>
                    </Field>
                    <Field label="Chamados (%)">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          style={{ ...INPUT_STYLE, borderColor: camposAuto.chamados ? '#16A34A' : '#E8E8E8' }}
                          value={chamados}
                          onChange={e => { setChamados(e.target.value); setCamposAuto(c => c.chamados ? { ...c, chamados: false } : c) }}
                          placeholder="0.0"
                          onFocus={e => e.target.style.borderColor = '#E5322D'}
                          onBlur={e => e.target.style.borderColor = camposAuto.chamados ? '#16A34A' : '#E8E8E8'}
                        />
                        <WarnBadge val={chamados} threshold={2.5} />
                      </div>
                    </Field>
                    <Field label="Tempo de Loja Aberta (%)">
                      <input
                        style={{ ...INPUT_STYLE, borderColor: camposAuto.tempoAberto ? '#16A34A' : '#E8E8E8' }}
                        value={tempoAberto}
                        onChange={e => { setTempoAberto(e.target.value); setCamposAuto(c => c.tempoAberto ? { ...c, tempoAberto: false } : c) }}
                        placeholder="0.0"
                        onFocus={e => e.target.style.borderColor = '#E5322D'}
                        onBlur={e => e.target.style.borderColor = camposAuto.tempoAberto ? '#16A34A' : '#E8E8E8'}
                      />
                    </Field>
                  </div>
                </div>

                {resultadoSalvo && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16A34A' }}>
                    <Check size={12}/> Dados enviados para esta semana
                  </span>
                )}
              </div>
            </div>

            {/* Separador entre seções */}
            <div style={{ padding: '16px 0' }}>
              <div style={{ height: '1px', background: '#F0F0F0' }} />
            </div>

            {/* Seção 2 — Relatório PDF */}
            <div>
              <SectionTitle label="Relatório PDF" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div>
                  <SectionTitle label="Contexto da Semana" />
                  <p style={{ fontSize: '11px', color: '#999999', marginBottom: '8px', lineHeight: 1.5 }}>
                    Informe eventos relevantes que impactaram os resultados (ex: aumento de preços, ajuste de cardápio, promoções, feriados...)
                  </p>
                  <textarea
                    value={contexto}
                    onChange={e => setContexto(e.target.value)}
                    placeholder="Ex: Aumentamos os preços na semana anterior. Fizemos um ajuste no cardápio removendo itens de baixa saída..."
                    rows={3}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '5px', padding: '10px 12px', fontSize: '13px', color: '#111111', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}
                    onFocus={e => e.target.style.borderColor = '#E5322D'}
                    onBlur={e => e.target.style.borderColor = '#E8E8E8'}
                  />
                </div>

                <div>
                  <SectionTitle label="Resumo" />
                  <textarea
                    value={resumoIA}
                    onChange={e => setResumoIA(e.target.value)}
                    placeholder="Texto gerado aparecerá aqui. Pode ser editado antes de salvar."
                    rows={6}
                    style={{ width: '100%', background: 'transparent', border: '1px solid #E8E8E8', borderRadius: '5px', padding: '10px 12px', fontSize: '13px', color: '#111111', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}
                    onFocus={e => e.target.style.borderColor = '#E5322D'}
                    onBlur={e => e.target.style.borderColor = '#E8E8E8'}
                  />
                  {resumoIA && (
                    <button
                      onClick={handleCopiar}
                      style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: copiado ? '#16A34A' : '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {copiado ? <><Check size={12}/> Copiado!</> : <><Copy size={12}/> Copiar texto</>}
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* Histórico */}
            <div>
              <SectionTitle label="Histórico" />
              {loadingHistorico ? (
                <p style={{ fontSize: '12px', color: '#999999', margin: 0 }}>Carregando…</p>
              ) : multiplasPlataformas ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {plataformasLoja.map(p => (
                    <div key={p}>
                      <div style={{ marginBottom: '6px' }}>
                        <PlatformBadge plataforma={p} />
                      </div>
                      <HistoricoLista
                        itens={historico[p] ?? []}
                        loadingHistDoc={loadingHistDoc}
                        onDownload={handleDownloadHistorico}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <HistoricoLista
                  itens={historico}
                  loadingHistDoc={loadingHistDoc}
                  onDownload={handleDownloadHistorico}
                />
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid #E8E8E8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button
            onClick={handleEnviarDados}
            disabled={loadingEnviar}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#666666', background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '5px', cursor: loadingEnviar ? 'not-allowed' : 'pointer', opacity: loadingEnviar ? 0.6 : 1, transition: 'border-color 150ms, color 150ms' }}
            onMouseEnter={e => { if (!loadingEnviar) { e.currentTarget.style.borderColor = '#DDDDDD'; e.currentTarget.style.color = '#111111' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.color = '#666666' }}
          >
            {loadingEnviar ? (
              <><Loader2 size={13} className="animate-spin" /> {resultadoSalvo ? 'Salvando…' : 'Enviando…'}</>
            ) : resultadoSalvo ? (
              <><Pencil size={13} strokeWidth={1.75} /> Editar Dados</>
            ) : 'Enviar Dados'}
          </button>

          <button
            onClick={handleGerarIA}
            disabled={loadingIA}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#666666', background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '5px', cursor: loadingIA ? 'not-allowed' : 'pointer', opacity: loadingIA ? 0.6 : 1, transition: 'border-color 150ms, color 150ms' }}
            onMouseEnter={e => { if (!loadingIA) { e.currentTarget.style.borderColor = '#DDDDDD'; e.currentTarget.style.color = '#111111' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.color = '#666666' }}
          >
            {loadingIA ? <><Loader2 size={13} className="animate-spin" /> Gerando…</> : 'Gerar Resumo'}
          </button>

          <button
            onClick={handleGerarSalvarPDF}
            disabled={loadingPDF}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 18px', fontSize: '13px', fontWeight: 500, color: '#fff', background: loadingPDF ? '#C42B26' : '#E5322D', border: 'none', borderRadius: '5px', cursor: loadingPDF ? 'not-allowed' : 'pointer', transition: 'filter 100ms' }}
            onMouseEnter={e => { if (!loadingPDF) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
          >
            {loadingPDF ? <><Loader2 size={13} className="animate-spin" /> Gerando PDF…</> : <><Download size={13}/> Gerar e Salvar PDF</>}
          </button>
        </div>
        </>
        )}
      </motion.div>
    </motion.div>
    <AnimatePresence>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </AnimatePresence>
    </>
  )
}

// ─── LojaCellCard ─────────────────────────────────────────────────────────────

function PlataformaMiniStatus({ plataforma, existe }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 500, color: existe ? '#16A34A' : '#999999' }}>
      {existe ? <Check size={8} strokeWidth={3} /> : null}
      {plataforma}{!existe ? ' pendente' : ''}
    </span>
  )
}

// Cores por plataforma reaproveitadas do PlatformBadge — usadas na borda
// esquerda dos cards de lojas agrupadas automaticamente pelo mesmo cliente.
const COR_BORDA_PLATAFORMA = {
  ifood:    '#EA1D2C',
  '99food': '#FFD700',
  keeta:    '#00B14F',
}

function corBordaCliente(loja) {
  const plataforma = plataformasDeLoja(loja)[0] ?? loja.plataforma
  const key = plataforma?.toLowerCase().replace(/\s+/g, '')
  return COR_BORDA_PLATAFORMA[key] ?? '#999999'
}

function LojaCellCard({ loja, reportStatus, onClickLoja, isDragging, dragHandleProps, innerRef, style, collapsed, agrupavel }) {
  const detalhes = reportStatus.detalhes
  const corGrupo  = agrupavel ? corBordaCliente(loja) : null
  return (
    <div
      ref={innerRef}
      {...dragHandleProps}
      style={{
        display: 'flex', flexDirection: 'column', gap: '3px',
        padding: collapsed ? '0' : '6px 8px', borderRadius: '5px',
        minWidth: 0, boxSizing: 'border-box',
        border: collapsed ? 'none' : (isDragging ? '2px solid #EA1D2C' : '1px solid #E8E8E8'),
        borderLeft: collapsed ? 'none' : (corGrupo ? `3px solid ${corGrupo}` : undefined),
        backgroundColor: isDragging ? '#FFFFFF' : '#F7F7F8',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
        transition: isDragging ? 'none' : 'border-color 150ms, background-color 150ms',
        height: collapsed ? 0 : undefined,
        margin: collapsed ? 0 : undefined,
        overflow: collapsed ? 'hidden' : undefined,
        pointerEvents: collapsed ? 'none' : undefined,
        ...style,
      }}
      onClick={() => onClickLoja(loja)}
      onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.borderColor = '#DDDDDD'; e.currentTarget.style.backgroundColor = '#FFFFFF' } }}
      onMouseLeave={e => { if (!isDragging) { e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.backgroundColor = '#F7F7F8' } }}
    >
      {!collapsed && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#111111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{loja.nome}</span>
            <ReportStatusBadge type={reportStatus.type} />
          </div>
          {detalhes && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {detalhes.map(d => (
                <PlataformaMiniStatus key={d.plataforma} plataforma={d.plataforma} existe={d.existe} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── ClienteHeader ────────────────────────────────────────────────────────────
// Header clicável acima das lojas de um mesmo cliente (quando ele tem mais de
// uma loja no dia) dentro de uma coluna do calendário — expande/colapsa os
// cards (que continuam montados no DOM pra não quebrar os índices do
// drag-and-drop, só ficam com display:none). Agrupamento automático: não
// depende de nenhum cadastro à parte, só de duas ou mais lojas com o mesmo
// clienteId aparecendo no mesmo dia.

function ClienteHeader({ clienteNome, lojasDoCliente, getReportStatus, collapsed, onToggle }) {
  const total = lojasDoCliente.length
  const enviados = lojasDoCliente.filter(l => getReportStatus(l).type === 'enviado').length

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
        padding: '4px 6px', cursor: 'pointer', userSelect: 'none',
        borderRadius: '4px', transition: 'background-color 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F0F0F0' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
        <ChevronRightIcon collapsed={collapsed} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clienteNome}
        </span>
        <span style={{ fontSize: '11px', color: '#999999', flexShrink: 0 }}>({total})</span>
      </div>
      <span style={{ fontSize: '10px', fontWeight: 500, color: enviados === total ? '#16A34A' : '#999999', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {enviados}/{total} enviados
      </span>
    </div>
  )
}

function ChevronRightIcon({ collapsed }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'transform 100ms', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── CalendarGrid ─────────────────────────────────────────────────────────────

function buildColumns(lojasList, prevColumns) {
  const map = {}
  DIAS.forEach(d => { map[d.key] = [] })
  const byId = Object.fromEntries(lojasList.map(l => [l.id, l]))
  const seen = new Set()

  if (prevColumns) {
    DIAS.forEach(d => {
      (prevColumns[d.key] ?? []).forEach(prevLoja => {
        const atual = byId[prevLoja.id]
        if (atual && atual.diaRelatorio === d.key && !seen.has(atual.id)) {
          map[d.key].push(atual)
          seen.add(atual.id)
        }
      })
    })
  }

  lojasList.forEach(l => {
    if (l.diaRelatorio && map[l.diaRelatorio] && !seen.has(l.id)) {
      map[l.diaRelatorio].push(l)
      seen.add(l.id)
    }
  })

  return map
}

function CalendarGrid({ lojas, statusMaps, onClickLoja, onDropLoja, onDefinirDia }) {
  const monday      = getWeekRange(getISOWeekStr())
  const todayOffset = todayISOOffset()

  const semDia = useMemo(() => lojas.filter(l => !l.diaRelatorio), [lojas])

  const [columns, setColumns] = useState(() => buildColumns(lojas))
  const [collapsedClientes, setCollapsedClientes] = useState(() => new Set())
  // Mobile: sem colunas lado a lado — abas de dia, uma coluna por vez.
  // Cai no dia de hoje se for dia útil da semana definida (seg-sáb); senão segunda.
  const [mobileDia, setMobileDia] = useState(() => DIAS[todayOffset]?.key ?? DIAS[0].key)

  function toggleCliente(clienteId) {
    setCollapsedClientes(prev => {
      const next = new Set(prev)
      if (next.has(clienteId)) next.delete(clienteId); else next.add(clienteId)
      return next
    })
  }

  useEffect(() => {
    setColumns(prev => buildColumns(lojas, prev))
  }, [lojas])

  function getReportStatus(loja) {
    const diaOffset      = DIAS.find(d => d.key === loja.diaRelatorio)?.offset ?? null
    const plataformas    = plataformasDeLoja(loja)
    const resPorPlataforma = statusMaps.resultados[loja.id] ?? {}

    if (plataformas.length > 1) {
      return computeLojaStatusMultiplataforma(diaOffset, todayOffset, plataformas, resPorPlataforma)
    }

    const key     = loja.plataforma || '_default'
    const resInfo = resPorPlataforma[key] ?? resPorPlataforma['_default']
    return computeLojaStatus(diaOffset, todayOffset, !!resInfo, !!resInfo?.enviado, !!statusMaps.relatorios[loja.id])
  }

  // Monta os itens (headers de cliente + cards) de uma coluna/dia — compartilhado
  // entre a visão desktop (draggable=true, dentro de Droppable/Draggable) e a
  // visão mobile em abas (draggable=false, card + select "mover para" no lugar
  // do arrastar, que não é confiável em touch ao lado de scroll).
  //
  // Agrupamento automático por cliente: sem cadastro à parte — sempre que 2+
  // lojas do mesmo clienteId aparecem no mesmo dia, ganham um header comum
  // (colapsável); cliente com só uma loja no dia fica solto na lista.
  function renderLojaItems(lojasDia, { draggable }) {
    const contagemPorCliente = {}
    lojasDia.forEach(l => {
      if (l.clienteId) contagemPorCliente[l.clienteId] = (contagemPorCliente[l.clienteId] ?? 0) + 1
    })

    const clientesVistos = new Set()
    const primeiraOcorrencia = new Set()
    lojasDia.forEach(l => {
      if (l.clienteId && contagemPorCliente[l.clienteId] > 1 && !clientesVistos.has(l.clienteId)) {
        clientesVistos.add(l.clienteId)
        primeiraOcorrencia.add(l.id)
      }
    })

    return lojasDia.map((loja, idx) => {
      const agrupavel = !!loja.clienteId && contagemPorCliente[loja.clienteId] > 1
      const ehColapsado = agrupavel ? collapsedClientes.has(loja.clienteId) : false
      const clienteHeader = agrupavel && primeiraOcorrencia.has(loja.id) && (
        <ClienteHeader
          clienteNome={loja.clienteNome ?? '—'}
          lojasDoCliente={lojasDia.filter(l => l.clienteId === loja.clienteId)}
          getReportStatus={getReportStatus}
          collapsed={ehColapsado}
          onToggle={() => toggleCliente(loja.clienteId)}
        />
      )

      if (draggable) {
        return (
          <Fragment key={loja.id}>
            {clienteHeader}
            <Draggable draggableId={loja.id} index={idx}>
              {(dragProvided, dragSnapshot) => {
                const card = (
                  <LojaCellCard
                    loja={loja}
                    reportStatus={getReportStatus(loja)}
                    onClickLoja={onClickLoja}
                    isDragging={dragSnapshot.isDragging}
                    innerRef={dragProvided.innerRef}
                    dragHandleProps={{ ...dragProvided.draggableProps, ...dragProvided.dragHandleProps }}
                    style={dragProvided.draggableProps.style}
                    collapsed={ehColapsado && !dragSnapshot.isDragging}
                    agrupavel={agrupavel}
                  />
                )
                return dragSnapshot.isDragging ? createPortal(card, document.body) : card
              }}
            </Draggable>
          </Fragment>
        )
      }

      if (ehColapsado) return <Fragment key={loja.id}>{clienteHeader}</Fragment>

      return (
        <Fragment key={loja.id}>
          {clienteHeader}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <LojaCellCard
              loja={loja}
              reportStatus={getReportStatus(loja)}
              onClickLoja={onClickLoja}
              collapsed={false}
              agrupavel={agrupavel}
            />
            <select
              value={loja.diaRelatorio ?? ''}
              onClick={e => e.stopPropagation()}
              onChange={e => { if (e.target.value) onDefinirDia(loja, e.target.value) }}
              className="select"
              style={{ height: '32px', fontSize: '12px' }}
            >
              <option value="" disabled>Mover para outro dia…</option>
              {DIAS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
        </Fragment>
      )
    })
  }

  function handleDragEnd(result) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const sourceDia = source.droppableId
    const destDia   = destination.droppableId

    setColumns(prev => {
      const next = { ...prev }
      const sourceList = Array.from(next[sourceDia] ?? [])
      const [moved] = sourceList.splice(source.index, 1)
      next[sourceDia] = sourceList
      if (sourceDia === destDia) {
        sourceList.splice(destination.index, 0, moved)
      } else {
        const destList = Array.from(next[destDia] ?? [])
        destList.splice(destination.index, 0, moved)
        next[destDia] = destList
      }
      return next
    })

    if (sourceDia !== destDia) {
      onDropLoja(draggableId, destDia)
    }
  }

  return (
    <>
    {/* Desktop (sm+): 6 colunas lado a lado, arrastar e soltar entre dias */}
    <div className="hidden sm:block">
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="controle-semanal-dnd" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', width: '100%', alignItems: 'start' }}>
        {DIAS.map(dia => {
          const date = new Date(monday)
          date.setUTCDate(monday.getUTCDate() + dia.offset)
          const dayStr  = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
          const isToday = dia.offset === todayOffset
          const lojasDia = columns[dia.key] ?? []

          return (
            // minWidth: 0 é essencial aqui — sem isso, o grid track "1fr" usa o
            // min-content da coluna (nome de loja sem quebra) como piso, e um
            // nome comprido força essa coluna a crescer além da fatia igual,
            // fazendo a largura oscilar durante o drag.
            <div key={dia.key} style={{ minWidth: 0 }}>
              <div style={{ padding: '8px 10px 7px', borderRadius: '5px 5px 0 0', border: isToday ? '1px solid rgba(229,50,45,0.4)' : '1px solid #E8E8E8', borderBottom: 'none', backgroundColor: isToday ? 'rgba(229,50,45,0.04)' : '#FFFFFF' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: isToday ? '#E5322D' : '#666666', margin: 0 }}>{dia.label}</p>
                <p style={{ fontSize: '11px', fontFamily: "'Segoe UI', system-ui, sans-serif", color: isToday ? 'rgba(229,50,45,0.7)' : '#999999', marginTop: '1px', marginBottom: 0 }}>{dayStr}</p>
              </div>
              <Droppable droppableId={dia.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      padding: '8px',
                      // Borda fixa em 1px sempre — o destaque de "arrastando por cima"
                      // usa outline (não participa do box model, não causa reflow)
                      // em vez de mudar a espessura/estilo da border, que forçava
                      // recálculo de layout do conteúdo interno a cada toggle e
                      // tremia a coluna inteira.
                      border: isToday ? '1px solid rgba(229,50,45,0.4)' : '1px solid #E8E8E8',
                      borderTop: 'none',
                      borderRadius: '0 0 5px 5px',
                      outline: snapshot.isDraggingOver ? '2px dashed #EA1D2C' : '2px solid transparent',
                      outlineOffset: '-2px',
                      backgroundColor: snapshot.isDraggingOver ? '#FFF0F1' : '#FAFAFA',
                      minHeight: '80px',
                      display: 'flex', flexDirection: 'column', gap: '5px',
                      transition: 'background-color 100ms',
                    }}
                  >
                    {lojasDia.length === 0 && !snapshot.isDraggingOver && (
                      <p style={{ fontSize: '11px', color: '#CCCCCC', textAlign: 'center', paddingTop: '8px', margin: 0 }}>—</p>
                    )}
                    {renderLojaItems(lojasDia, { draggable: true })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
    </div>

    {/* Mobile (<sm): abas de dia, uma coluna por vez — sem drag, "mover para" no card */}
    <div className="sm:hidden">
      <div className="flex gap-1.5 overflow-x-auto" style={{ paddingBottom: '10px' }}>
        {DIAS.map(dia => {
          const isToday = dia.offset === todayOffset
          const active  = mobileDia === dia.key
          return (
            <button
              key={dia.key}
              type="button"
              onClick={() => setMobileDia(dia.key)}
              style={{
                flexShrink: 0, minHeight: '40px', padding: '0 14px', borderRadius: '6px',
                fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
                border: `1px solid ${active ? '#FF4B2E' : '#E8E8E8'}`,
                backgroundColor: active ? '#FFF1ED' : '#FFFFFF',
                color: active ? '#FF4B2E' : (isToday ? '#FF4B2E' : '#666666'),
              }}
            >
              {dia.label}
            </button>
          )
        })}
      </div>
      <div style={{
        backgroundColor: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: '8px',
        padding: '8px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {(columns[mobileDia] ?? []).length === 0 ? (
          <p style={{ fontSize: '12px', color: '#CCCCCC', textAlign: 'center', padding: '16px 0', margin: 0 }}>
            Nenhuma loja neste dia.
          </p>
        ) : (
          renderLojaItems(columns[mobileDia] ?? [], { draggable: false })
        )}
      </div>
    </div>

    {semDia.length > 0 && (
      <div style={{ marginTop: '16px' }}>
        <p className="section-label" style={{ marginBottom: '8px' }}>Lojas sem dia definido</p>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {semDia.map((loja, idx) => (
            <div
              key={loja.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
              style={{ padding: '10px 16px', borderBottom: idx < semDia.length - 1 ? '1px solid #F3F3F3' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: '#111111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loja.nome}</span>
                <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 7px', borderRadius: '4px', color: '#92400E', backgroundColor: 'rgba(202,138,4,0.12)', border: '1px solid rgba(202,138,4,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Sem dia definido
                </span>
              </div>
              <select
                value=""
                onChange={e => { if (e.target.value) onDefinirDia(loja, e.target.value) }}
                className="select w-full sm:w-auto"
                style={{ height: '36px', fontSize: '12px', flexShrink: 0 }}
              >
                <option value="">Definir dia…</option>
                {DIAS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ControleSemanal() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const { modoTesteAtivo, organizacaoIdsPermitidos } = useModoTeste()
  const toast = useToast()

  // A semana de referência pra badges/lançamentos é sempre a semana anterior
  // à atual — fixa (não é mais um seletor navegável na página; a semana que
  // pode ser trocada manualmente fica dentro do LojaModal).
  const semanaAnteriorAtual = useMemo(() => getSemanaAnteriorAtual(), [])

  const [lojas,          setLojas]          = useState([])
  const [gestoresMap,    setGestoresMap]    = useState({})
  const [statusMaps,     setStatusMaps]     = useState({ resultados: {}, relatorios: {} })
  const [loadingLojas,   setLoadingLojas]   = useState(true)
  const [loadingStatus,  setLoadingStatus]  = useState(false)
  const [statusRefresh,  setStatusRefresh]  = useState(0)

  const [lojaModal,       setLojaModal]       = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingLojas(true)

    async function load() {
      try {
        const escopoOrg = modoTesteAtivo
          ? [where('organizacaoId', 'in', organizacaoIdsPermitidos.slice(0, 10))]
          : isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
        const [lojasSnap, gestoresSnap] = await Promise.all([
          isAdmin
            ? getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg))
            : getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoOrg, where('gestorId', '==', user.uid))),
          isAdmin
            ? getDocs(query(collection(db, COLLECTIONS.USERS), ...escopoOrg, where('role', '==', 'gestor')))
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setLojas(
          lojasSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(l => l.status?.toLowerCase() !== 'cancelada' && !!l.gestorId)
        )
        if (gestoresSnap) {
          const gMap = {}
          gestoresSnap.docs.forEach(d => { gMap[d.id] = { id: d.id, ...d.data() } })
          setGestoresMap(gMap)
        } else {
          setGestoresMap({ [user.uid]: { id: user.uid, nome: user.nome } })
        }
      } catch {
        toast('Erro ao carregar lojas.', 'error')
      } finally {
        if (!cancelled) setLoadingLojas(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, isAdmin, isSuperAdmin, toast])

  // Status do calendário: existência de `resultados`/`relatorios` para a
  // semana anterior atual (fixa) — não depende de nenhum seletor da página.
  useEffect(() => {
    if (!user || lojas.length === 0) { setStatusMaps({ resultados: {}, relatorios: {} }); return }
    let cancelled = false
    setLoadingStatus(true)

    async function load() {
      try {
        const resConstraints = [where('semana', '==', semanaAnteriorAtual)]
        const relConstraints = [where('semana', '==', semanaAnteriorAtual)]
        if (!isSuperAdmin) {
          resConstraints.push(where('organizacaoId', '==', user.organizacaoId ?? null))
          relConstraints.push(where('organizacaoId', '==', user.organizacaoId ?? null))
        }
        if (!isAdmin) {
          resConstraints.push(where('gestorId', '==', user.uid))
          relConstraints.push(where('gestorId', '==', user.uid))
        }
        const [resSnap, relSnap] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.RESULTADOS), ...resConstraints)),
          getDocs(query(collection(db, RELATORIOS_PDF_COL), ...relConstraints)),
        ])
        if (cancelled) return
        const resMap = {}
        resSnap.docs.forEach(d => {
          const data = d.data()
          const key  = data.plataforma || '_default'
          if (!resMap[data.lojaId]) resMap[data.lojaId] = {}
          resMap[data.lojaId][key] = { enviado: !!data.relatorioEnviado }
        })
        const relMap = {}; relSnap.docs.forEach(d => { relMap[d.data().lojaId] = true })
        setStatusMaps({ resultados: resMap, relatorios: relMap })
      } catch (err) {
        console.error('[ControleSemanal] load status:', err?.code, err?.message)
      } finally {
        if (!cancelled) setLoadingStatus(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, isAdmin, lojas, semanaAnteriorAtual, statusRefresh])

  // Escrita no sistema legado de "envio" (usado pelo checklist do Dashboard) —
  // mantido só como espelho pra não quebrar o Dashboard, não é mais lido aqui.
  async function marcarEnvio(loja, semana, isoTime) {
    try {
      const docRef = doc(db, RELATORIOS_COL, `${loja.gestorId}_${semana}`)
      const now = isoTime || new Date().toISOString()
      try {
        await updateDoc(docRef, { [`lojas.${loja.id}.enviado`]: true, [`lojas.${loja.id}.dataEnvio`]: now })
      } catch (err) {
        if (err.code === 'not-found') {
          await setDoc(docRef, {
            gestorId: loja.gestorId,
            organizacaoId: loja.organizacaoId ?? user.organizacaoId ?? null,
            semana,
            lojas: { [loja.id]: { enviado: true, dataEnvio: now } },
          })
        } else throw err
      }
    } catch (err) {
      console.error('[ControleSemanal] marcarEnvio:', err?.code, err?.message)
    }
  }

  async function handleDefinirDia(loja, diaRelatorio) {
    try {
      await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), { diaRelatorio })
      setLojas(prev => prev.map(l => l.id === loja.id ? { ...l, diaRelatorio } : l))
      toast(`Dia definido: ${DIAS.find(d => d.key === diaRelatorio)?.label}`, 'success')
    } catch {
      toast('Erro ao atualizar. Tente novamente.', 'error')
    }
  }

  const { totalEnviados, totalLojas } = useMemo(() => {
    let enviados = 0
    lojas.forEach(l => {
      const plataformas = plataformasDeLoja(l)
      const porPlataforma = statusMaps.resultados[l.id] ?? {}
      const enviadoResultado = plataformas.length > 1
        ? plataformas.length > 0 && plataformas.every(p => porPlataforma[p]?.enviado)
        : !!(porPlataforma[l.plataforma || '_default'] ?? porPlataforma['_default'])?.enviado
      if (statusMaps.relatorios[l.id] || enviadoResultado) enviados++
    })
    return { totalEnviados: enviados, totalLojas: lojas.length }
  }, [lojas, statusMaps])

  const gestorGroups = useMemo(() => {
    if (!isAdmin) return null
    const groups = {}
    lojas.forEach(l => { const key = l.gestorId || SEM_GESTOR_KEY; if (!groups[key]) groups[key] = []; groups[key].push(l) })
    return Object.entries(groups)
      .map(([gestorId, lojasList]) => ({
        gestorId,
        semGestor:  gestorId === SEM_GESTOR_KEY,
        gestorNome: gestorId === SEM_GESTOR_KEY ? 'Sem gestor' : (gestoresMap[gestorId]?.nome ?? '—'),
        lojas: [...lojasList].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .sort((a, b) => {
        if (a.semGestor !== b.semGestor) return a.semGestor ? -1 : 1
        return a.gestorNome.localeCompare(b.gestorNome, 'pt-BR')
      })
  }, [isAdmin, lojas, gestoresMap])

  const sortedLojas = useMemo(
    () => isAdmin ? [] : [...lojas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [isAdmin, lojas]
  )

  if (loadingLojas) {
    return (
      <div style={{ padding: '28px 20px' }}>
        <div style={{ height: '16px', width: '160px', backgroundColor: '#FFFFFF', borderRadius: '4px', marginBottom: '20px' }} className="animate-skeleton" />
        <Skeleton.Table rows={6} cols={6} />
      </div>
    )
  }

  return (
    <motion.div style={{ padding: '28px 20px' }} variants={pageVariants} initial="initial" animate="animate">
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Controle Semanal</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '8px 16px', textAlign: 'center', minWidth: '64px' }}>
            <span style={{ display: 'block', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '20px', lineHeight: 1, color: '#16A34A', fontWeight: 500 }}>{totalEnviados}</span>
            <span className="section-label" style={{ fontSize: '10px', textTransform: 'lowercase' }}>enviados</span>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '8px 16px', textAlign: 'center', minWidth: '64px' }}>
            <span style={{ display: 'block', fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '20px', lineHeight: 1, color: '#DC2626', fontWeight: 500 }}>{totalLojas - totalEnviados}</span>
            <span className="section-label" style={{ fontSize: '10px', textTransform: 'lowercase' }}>pendentes</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loadingStatus ? (
        <Skeleton.Table rows={4} cols={6} />
      ) : isAdmin ? (
        gestorGroups && gestorGroups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {gestorGroups.map(group => (
              <div key={group.gestorId}>
                {group.semGestor ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', backgroundColor: '#FFF5F5', border: '1px solid #FECACA', borderLeft: '3px solid #E5322D', borderRadius: '6px', padding: '8px 12px' }}>
                    <AlertTriangle size={13} strokeWidth={1.5} color="#DC2626" />
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#DC2626', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Sem gestor — {group.lojas.length} loja{group.lojas.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                ) : (
                  <p className="section-label" style={{ marginBottom: '10px' }}>{group.gestorNome}</p>
                )}
                <CalendarGrid
                  lojas={group.lojas}
                  statusMaps={statusMaps}
                  onClickLoja={loja => setLojaModal({ loja })}
                  onDropLoja={(lojaId, novoDia) => handleDefinirDia({ id: lojaId }, novoDia)}
                  onDefinirDia={handleDefinirDia}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '12px', color: '#999999', margin: 0 }}>Nenhuma loja cadastrada.</p>
          </div>
        )
      ) : (
        <CalendarGrid
          lojas={sortedLojas}
          statusMaps={statusMaps}
          onClickLoja={loja => setLojaModal({ loja })}
          onDropLoja={(lojaId, novoDia) => handleDefinirDia({ id: lojaId }, novoDia)}
          onDefinirDia={handleDefinirDia}
        />
      )}

      {/* LojaModal */}
      <AnimatePresence>
        {lojaModal && (
          <LojaModal
            key={lojaModal.loja.id}
            loja={lojaModal.loja}
            onClose={() => setLojaModal(null)}
            onSaved={() => setStatusRefresh(n => n + 1)}
            onMarcarEnvio={marcarEnvio}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
