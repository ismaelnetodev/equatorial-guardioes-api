import { randomBytes } from 'node:crypto'
import { Prisma } from '../generated/prisma/client.js'
import { creditPoints, type PointsDb } from './points-ledger.js'
import { getPrisma } from './prisma.js'
import { publishedModuleWhere, publishedTrailWhere } from './content-visibility.js'

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += INVITE_CODE_ALPHABET[bytes[i]! % INVITE_CODE_ALPHABET.length]
  }
  return code
}

export async function ensureUserInviteCode(
  userId: string,
  db: PointsDb = getPrisma(),
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  })
  if (!user) throw new Error('Usuário não encontrado.')
  if (user.inviteCode) return user.inviteCode

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = generateInviteCode()
    try {
      const updated = await db.user.update({
        where: { id: userId },
        data: { inviteCode },
        select: { inviteCode: true },
      })
      if (updated.inviteCode) return updated.inviteCode
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw new Error('Não foi possível gerar um código de convite único.')
}

export async function attributeInviteOnRegister(
  inviteeId: string,
  rawInviteCode: string | undefined,
  db: PointsDb = getPrisma(),
): Promise<void> {
  const inviteCode = rawInviteCode?.trim()
  if (!inviteCode) return

  const inviter = await db.user.findFirst({
    where: { inviteCode, id: { not: inviteeId } },
    select: { id: true },
  })
  if (!inviter) return

  try {
    await db.inviteAttribution.create({
      data: {
        inviterId: inviter.id,
        inviteeId,
        inviteCode,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return
    }
    throw error
  }
}

async function readConfigValue(key: string, fallback: number, db: PointsDb): Promise<number> {
  const row = await db.programConfiguration.findUnique({
    where: { key },
    select: { value: true, isActive: true },
  })
  if (!row?.isActive || row.value == null || row.value < 0) return fallback
  return row.value
}

/**
 * When the invitee completes module 0, credit the inviter once (subject to invite_reward_limit).
 */
export async function maybeAwardInviteOnModule0(
  inviteeId: string,
  moduleId: string,
  db: PointsDb = getPrisma(),
): Promise<void> {
  const firstModule = await db.trail.findFirst({
    where: publishedTrailWhere,
    orderBy: { order: 'asc' },
    select: {
      modules: {
        where: publishedModuleWhere,
        orderBy: { order: 'asc' },
        take: 1,
        select: { id: true },
      },
    },
  })
  if (firstModule?.modules[0]?.id !== moduleId) return

  const attribution = await db.inviteAttribution.findUnique({
    where: { inviteeId },
    select: {
      id: true,
      inviterId: true,
      module0CompletedAt: true,
      pointsAwarded: true,
    },
  })
  if (!attribution || attribution.module0CompletedAt) return

  const now = new Date()
  const reward = await readConfigValue('invite_module0_reward', 50, db)
  const limit = await readConfigValue('invite_reward_limit', 10, db)

  const awardedCount = await db.inviteAttribution.count({
    where: { inviterId: attribution.inviterId, pointsAwarded: { gt: 0 } },
  })

  let pointsAwarded = 0
  if (reward > 0 && awardedCount < limit) {
    await creditPoints(
      {
        userId: attribution.inviterId,
        amount: reward,
        reason: 'INVITE_REWARD',
        sourceType: 'InviteAttribution',
        sourceId: attribution.id,
      },
      db,
    )
    pointsAwarded = reward
  }

  await db.inviteAttribution.update({
    where: { id: attribution.id },
    data: {
      module0CompletedAt: now,
      pointsAwarded,
    },
  })
}
