import process from 'node:process'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL must be configured to access the database.')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

let prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma
  }
  return prisma
}
