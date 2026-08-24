/* global process */
// Recria conversas fictícias para testar o painel de WhatsApp localmente.
// Requer GOOGLE_APPLICATION_CREDENTIALS apontando para uma service account.
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/seed-conversas-whatsapp.js

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const conversas = [
  {
    phone: '5541999000001',
    nome: 'Marina Oliveira',
    ultimaMensagem: 'Preciso de ajuda com meu pedido agora.',
    coluna: 'leads',
    status: 'pendente',
    responsavel: null,
    lida: false,
    mensagens: [
      { de: 'contato', texto: 'Olá, meu pedido ainda não chegou.', timestamp: new Date('2026-08-24T11:20:00-03:00') },
      { de: 'bot', texto: 'Vou verificar. Pode informar o número do pedido?', timestamp: new Date('2026-08-24T11:22:00-03:00') },
      { de: 'contato', texto: 'Preciso de ajuda com meu pedido agora.', timestamp: new Date('2026-08-24T11:25:00-03:00') },
    ],
  },
  {
    phone: '5541999000002',
    nome: 'Carlos Mendes',
    ultimaMensagem: 'Obrigado, problema resolvido.',
    coluna: 'clientes',
    status: 'respondido',
    responsavel: 'luiz',
    lida: true,
    mensagens: [
      { de: 'contato', texto: 'Vocês atendem aos domingos?', timestamp: new Date('2026-08-24T09:05:00-03:00') },
      { de: 'luiz', texto: 'Sim, das 11h às 22h.', timestamp: new Date('2026-08-24T09:08:00-03:00') },
      { de: 'contato', texto: 'Obrigado, problema resolvido.', timestamp: new Date('2026-08-24T09:10:00-03:00') },
    ],
  },
  {
    phone: '5541999000003',
    nome: 'Ana Souza',
    ultimaMensagem: 'Pode confirmar a alteração para mim?',
    coluna: 'gestores',
    status: 'aguardando',
    responsavel: 'geovana',
    lida: false,
    mensagens: [
      { de: 'contato', texto: 'Consigo alterar o endereço da entrega?', timestamp: new Date('2026-08-23T16:40:00-03:00') },
      { de: 'bot', texto: 'Um responsável vai confirmar a alteração para você.', timestamp: new Date('2026-08-23T16:41:00-03:00') },
      { de: 'contato', texto: 'Pode confirmar a alteração para mim?', timestamp: new Date('2026-08-23T16:43:00-03:00') },
    ],
  },
]

async function main() {
  const batch = db.batch()
  conversas.forEach(conversa => {
    const ref = db.collection('conversas_whatsapp').doc(conversa.phone)
    batch.set(ref, { ...conversa, ultimaAtividade: FieldValue.serverTimestamp() })
  })
  await batch.commit()
  console.log(`✓ ${conversas.length} conversas de WhatsApp criadas.`)
}

main().catch((err) => {
  console.error('✕ Falha ao criar conversas de WhatsApp:', err.message)
  process.exit(1)
})
