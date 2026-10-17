import { Prisma, type PointLedgerReason } from '../generated/prisma/client.js'
import { getPrisma } from './prisma.js'

export type PointsDb = Prisma.TransactionClient | ReturnType<typeof getPrisma>

export class PointsLedgerError extends Error {
  constructor(
    public readonly code: 'INSUFFICIENT_BALANCE' | 'INVALID_AMOUNT',
    message: string,
  ) {
    super(message)
  }
}

export interface CreditPointsInput {
  userId: string
  amount: number
  reason: PointLedgerReason
  sourceType: string
  sourceId: string
  /** Credits always affect accumulated; defaults to true. */
  affectsAccumulated?: boolean
}

export interface DebitPointsInput {
  userId: string
  amount: number
  reason: PointLedgerReason
  sourceType: string
  sourceId: string
}

export interface PointAccountSnapshot {
  userId: string
  accumulated: number
  balance: number
}

async function ensureAccount(db: PointsDb, userId: string) {
  return db.pointAccount.upsert({
    where: { userId },
    create: { userId, accumulated: 0, balance: 0 },
    update: {},
    select: { userId: true, accumulated: true, balance: true },
  })
}

/**
 * Credits points idempotently by (reason, sourceType, sourceId).
 * Increases balance always; increases accumulated when affectsAccumulated is true (default).
 */
export async function creditPoints(
  input: CreditPointsInput,
  db: PointsDb = getPrisma(),
): Promise<PointAccountSnapshot> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new PointsLedgerError('INVALID_AMOUNT', 'O crédito deve ser um inteiro positivo.')
  }
  const affectsAccumulated = input.affectsAccumulated ?? true

  try {
    await db.pointLedgerEntry.create({
      data: {
        userId: input.userId,
        delta: input.amount,
        affectsAccumulated,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ensureAccount(db, input.userId)
    }
    throw error
  }

  await ensureAccount(db, input.userId)
  return db.pointAccount.update({
    where: { userId: input.userId },
    data: {
      balance: { increment: input.amount },
      ...(affectsAccumulated ? { accumulated: { increment: input.amount } } : {}),
    },
    select: { userId: true, accumulated: true, balance: true },
  })
}

/**
 * Debits balance only (does not reduce accumulated / ranking).
 * Idempotent by (reason, sourceType, sourceId).
 */
export async function debitPoints(
  input: DebitPointsInput,
  db: PointsDb = getPrisma(),
): Promise<PointAccountSnapshot> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new PointsLedgerError('INVALID_AMOUNT', 'O débito deve ser um inteiro positivo.')
  }

  const existing = await db.pointLedgerEntry.findFirst({
    where: {
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
    select: { id: true },
  })
  if (existing) {
    return ensureAccount(db, input.userId)
  }

  const account = await ensureAccount(db, input.userId)
  if (account.balance < input.amount) {
    throw new PointsLedgerError('INSUFFICIENT_BALANCE', 'Saldo insuficiente para esta operação.')
  }

  try {
    await db.pointLedgerEntry.create({
      data: {
        userId: input.userId,
        delta: -input.amount,
        affectsAccumulated: false,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ensureAccount(db, input.userId)
    }
    throw error
  }

  return db.pointAccount.update({
    where: { userId: input.userId },
    data: { balance: { decrement: input.amount } },
    select: { userId: true, accumulated: true, balance: true },
  })
}

export async function getOrCreatePointAccount(
  userId: string,
  db: PointsDb = getPrisma(),
): Promise<PointAccountSnapshot> {
  return ensureAccount(db, userId)
}
