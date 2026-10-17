import 'dotenv/config'
import { getPrisma } from '../lib/prisma.js'
import { hashPassword } from '../modules/auth/auth.service.js'

// Recebe credenciais por stdin: não grava senha no repositório ou nos logs.
let input = ''
for await (const chunk of process.stdin) input += String(chunk)
const credentials: unknown = JSON.parse(input)
if (!credentials || typeof credentials !== 'object' || !('email' in credentials) || !('password' in credentials)
  || typeof credentials.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)
  || typeof credentials.password !== 'string' || credentials.password.length < 1 || credentials.password.length > 128) {
  throw new Error('Informe um JSON com email e password válidos pelo stdin.')
}
const db = getPrisma()
try {
  const email = credentials.email.trim().toLowerCase()
  const passwordHash = await hashPassword(credentials.password)
  const account = await db.user.upsert({
    where: { email },
    create: { email, passwordHash, role: 'ADMIN', name: 'Administrador', neighborhood: 'Não informado', termsAcceptedAt: new Date() },
    update: { role: 'ADMIN', passwordHash },
    select: { email: true, role: true },
  })
  console.log(JSON.stringify({ message: 'Conta administrativa configurada.', ...account }))
} finally { await db.$disconnect() }
