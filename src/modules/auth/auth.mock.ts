import { randomUUID, scryptSync } from 'node:crypto'

export interface MockUser {
  id: string
  name: string
  email?: string
  cellphone?: string
  neighborhood: string
  inviteCode?: string
  termsAcceptedAt: string
  passwordHash: string
}

const mockSalt = 'a4ec3c18d4f9127bc8e0d6aa9fd36145'
const mockPasswordHash = `${mockSalt}:${scryptSync('senha-ficticia-123', mockSalt, 64).toString('hex')}`

export const usersMock: MockUser[] = [
  {
    id: randomUUID(),
    name: 'Maria da Silva',
    email: 'maria.silva@exemplo.com',
    cellphone: '+5585999990000',
    neighborhood: 'Aldeota',
    termsAcceptedAt: '2026-01-01T00:00:00.000Z',
    passwordHash: mockPasswordHash,
  },
]
