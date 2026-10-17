import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { attributeInviteOnRegister, generateInviteCode } from '../../lib/invite-attribution.js'
import { getPrisma } from '../../lib/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import type { Credentials, LoginCredentials } from './auth.schemas.js'

export class AuthError extends Error {
  constructor(
    public readonly code: 'CONTACT_REQUIRED' | 'CONTACT_ALREADY_REGISTERED' | 'INVALID_CREDENTIALS' | 'INVALID_NEIGHBORHOOD',
    message: string,
  ) {
    super(message)
  }
}

export interface PublicUser {
  id: string
  name: string
  email?: string
  cellphone?: string
  neighborhood: string
}

function toPublicUser(user: { id: string; name: string; email: string | null; cellphone: string | null; neighborhood: string }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    ...(user.email ? { email: user.email } : {}),
    ...(user.cellphone ? { cellphone: user.cellphone } : {}),
    neighborhood: user.neighborhood,
  }
}

function normalizedEmail(email: string | undefined): string | undefined {
  return email?.trim().toLowerCase() || undefined
}

function normalizedCellphone(cellphone: string | undefined): string | undefined {
  return cellphone?.trim() || undefined
}

function validateContact(email: string | undefined, cellphone: string | undefined): void {
  if (!email && !cellphone) {
    throw new AuthError('CONTACT_REQUIRED', 'Informe ao menos um e-mail ou celular.')
  }
}

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) return reject(error)
      resolve(key)
    })
  })
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await deriveKey(password, salt)
  return `${salt}:${derivedKey.toString('hex')}`
}

async function passwordsMatch(password: string, passwordHash: string): Promise<boolean> {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false

  const derivedKey = await deriveKey(password, salt)
  const storedKey = Buffer.from(storedHash, 'hex')
  return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey)
}

export async function registerUser(credentials: Credentials): Promise<PublicUser> {
  const email = normalizedEmail(credentials.email)
  const cellphone = normalizedCellphone(credentials.cellphone)
  validateContact(email, cellphone)

  const neighborhood = credentials.neighborhoodId
    ? await getPrisma().neighborhood.findUnique({ where: { id: credentials.neighborhoodId } })
    : null
  if (credentials.neighborhoodId && (!neighborhood || neighborhood.municipalityCode !== '2111300')) {
    throw new AuthError('INVALID_NEIGHBORHOOD', 'Selecione um bairro de São Luís ou informe Outro bairro.')
  }
  if (credentials.name.trim().length < 2 || credentials.neighborhood.trim().length < 2) {
    throw new AuthError('INVALID_NEIGHBORHOOD', 'Informe seu nome e bairro com pelo menos 2 caracteres.')
  }

  const existingUser = await getPrisma().user.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(cellphone ? [{ cellphone }] : [])] },
    select: { id: true },
  })
  if (existingUser) {
    throw new AuthError('CONTACT_ALREADY_REGISTERED', 'Este e-mail ou celular já está cadastrado.')
  }

  const passwordHash = await hashPassword(credentials.password)
  const incomingInviteCode = credentials.inviteCode?.trim() || undefined

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const user = await getPrisma().$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: credentials.name.trim(),
            email: email ?? null,
            cellphone: cellphone ?? null,
            neighborhood: neighborhood?.name ?? credentials.neighborhood.trim(),
            neighborhoodId: neighborhood?.id ?? null,
            inviteCode: generateInviteCode(),
            termsAcceptedAt: new Date(),
            passwordHash,
            pointAccount: { create: { accumulated: 0, balance: 0 } },
          },
        })
        await attributeInviteOnRegister(created.id, incomingInviteCode, tx)
        return created
      })
      return toPublicUser(user)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.['target']
        const targets = Array.isArray(target) ? target.map(String) : [String(target ?? '')]
        if (targets.some((item) => item.includes('inviteCode'))) continue
        throw new AuthError('CONTACT_ALREADY_REGISTERED', 'Este e-mail ou celular já está cadastrado.')
      }
      throw error
    }
  }
  throw new AuthError('CONTACT_ALREADY_REGISTERED', 'Este e-mail ou celular já está cadastrado.')
}

export async function loginUser(credentials: LoginCredentials): Promise<PublicUser> {
  const email = normalizedEmail(credentials.email)
  const cellphone = normalizedCellphone(credentials.cellphone)
  validateContact(email, cellphone)
  const user = await getPrisma().user.findFirst({
    where: { OR: [...(email ? [{ email }] : []), ...(cellphone ? [{ cellphone }] : [])] },
  })

  if (!user || !(await passwordsMatch(credentials.password, user.passwordHash))) {
    throw new AuthError('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
  }

  return toPublicUser(user)
}
