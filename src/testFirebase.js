import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyBrOl8KlLBqxINgaucxDjNRTu62YqRMMYc',
  authDomain:        'ihubfood.firebaseapp.com',
  projectId:         'ihubfood',
  storageBucket:     'ihubfood.firebasestorage.app',
  messagingSenderId: '454577135355',
  appId:             '1:454577135355:web:7db40d1de899e11395da5e',
}

const [,, email, password] = process.argv

if (!email || !password) {
  console.error('Uso: node src/testFirebase.js <email> <senha>')
  process.exit(1)
}

const app  = initializeApp(firebaseConfig, 'test')
const auth = getAuth(app)

console.log(`\nTestando login com: ${email}`)
console.log('─'.repeat(40))

try {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Login bem-sucedido!')
  console.log('  UID:         ', credential.user.uid)
  console.log('  Email:       ', credential.user.email)
  console.log('  Email verify:', credential.user.emailVerified)
} catch (err) {
  console.error('✗ Falha no login')
  console.error('  Código:   ', err.code)
  console.error('  Mensagem: ', err.message)
}

process.exit(0)
