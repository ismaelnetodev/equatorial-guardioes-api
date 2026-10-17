import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { resolveGuardianLevel } from '../../lib/guardian-level.js'
import {
  attributeInviteOnRegister,
  ensureUserInviteCode,
} from '../../lib/invite-attribution.js'
import {
  debitPoints,
  getOrCreatePointAccount,
  PointsLedgerError,
} from '../../lib/points-ledger.js'
import { getPrisma } from '../../lib/prisma.js'

export class CommunityError extends Error {
  constructor(
    public readonly code:
      | 'REWARD_NOT_FOUND'
      | 'REWARD_NOT_REDEEMABLE'
      | 'INSUFFICIENT_BALANCE'
      | 'VALIDATED_REPORTS_REQUIRED'
      | 'INVITE_ALREADY_ATTRIBUTED'
      | 'INVITE_INVALID',
    message: string,
  ) {
    super(message)
  }
}

async function readConfigValue(key: string, fallback: number): Promise<number> {
  const row = await getPrisma().programConfiguration.findUnique({
    where: { key },
    select: { value: true, isActive: true },
  })
  if (!row?.isActive || row.value == null || row.value < 0) return fallback
  return row.value
}

function levelPayload(level: Awaited<ReturnType<typeof resolveGuardianLevel>>) {
  return {
    code: level.code,
    name: level.name,
    nextLevel: level.nextLevel,
    pointsToNextLevel: level.pointsToNextLevel,
  }
}

export async function getRanking(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { neighborhood: true },
  })
  if (!user) throw new Error('Usuário não encontrado.')

  const account = await getOrCreatePointAccount(userId)
  const rows = await getPrisma().user.findMany({
    select: {
      neighborhood: true,
      pointAccount: { select: { accumulated: true } },
    },
  })

  const byNeighborhood = new Map<string, { accumulatedPoints: number; guardiansCount: number }>()
  for (const row of rows) {
    const key = row.neighborhood.trim() || 'Sem bairro'
    const current = byNeighborhood.get(key) ?? { accumulatedPoints: 0, guardiansCount: 0 }
    current.accumulatedPoints += row.pointAccount?.accumulated ?? 0
    current.guardiansCount += 1
    byNeighborhood.set(key, current)
  }

  const ranked = [...byNeighborhood.entries()]
    .map(([neighborhood, stats]) => ({ neighborhood, ...stats }))
    .sort((a, b) => {
      if (b.accumulatedPoints !== a.accumulatedPoints) return b.accumulatedPoints - a.accumulatedPoints
      if (b.guardiansCount !== a.guardiansCount) return b.guardiansCount - a.guardiansCount
      return a.neighborhood.localeCompare(b.neighborhood, 'pt-BR')
    })
    .map((item, index) => ({
      rank: index + 1,
      neighborhood: item.neighborhood,
      accumulatedPoints: item.accumulatedPoints,
      guardiansCount: item.guardiansCount,
      isCurrentUserNeighborhood: item.neighborhood === user.neighborhood,
    }))

  const neighborhoodTotal =
    ranked.find((item) => item.isCurrentUserNeighborhood)?.accumulatedPoints ?? 0
  const neighborhoodSharePercent =
    neighborhoodTotal <= 0
      ? 0
      : Math.round((account.accumulated / neighborhoodTotal) * 1000) / 10

  return {
    neighborhoods: ranked,
    yourContribution: {
      accumulatedPoints: account.accumulated,
      neighborhoodSharePercent,
      neighborhood: user.neighborhood,
    },
  }
}

export async function getRewards(userId: string) {
  const account = await getOrCreatePointAccount(userId)
  const level = await resolveGuardianLevel(account.accumulated)
  const configs = await getPrisma().programConfiguration.findMany({
    where: { kind: 'REWARD', isActive: true },
    orderBy: [{ value: 'asc' }, { key: 'asc' }],
    select: {
      key: true,
      name: true,
      description: true,
      value: true,
      unit: true,
    },
  })

  const validatedReportsRequired = await readConfigValue('redemption_validated_reports', 2)
  const validatedReports = await getPrisma().report.count({
    where: { userId, status: 'RESOLVED' },
  })
  const meetsReportGate = validatedReports >= validatedReportsRequired

  return {
    balance: account.balance,
    accumulated: account.accumulated,
    level: levelPayload(level),
    rewards: configs.map((reward) => {
      const cost = reward.value
      const redeemableByCost = cost != null && cost > 0 && reward.unit === 'points'
      const canAfford = redeemableByCost && account.balance >= cost
      const canRedeem = Boolean(redeemableByCost && canAfford && meetsReportGate)
      const pointsMissing =
        !redeemableByCost || cost == null
          ? null
          : Math.max(0, cost - account.balance)
      return {
        key: reward.key,
        name: reward.name,
        description: reward.description,
        cost,
        unit: reward.unit,
        canRedeem,
        pointsMissing,
      }
    }),
  }
}

export async function redeemReward(userId: string, rewardKey: string) {
  const reward = await getPrisma().programConfiguration.findUnique({
    where: { key: rewardKey },
    select: {
      key: true,
      kind: true,
      isActive: true,
      value: true,
      unit: true,
    },
  })
  if (!reward || reward.kind !== 'REWARD') {
    throw new CommunityError('REWARD_NOT_FOUND', 'Recompensa não encontrada.')
  }
  if (!reward.isActive || reward.value == null || reward.value <= 0 || reward.unit !== 'points') {
    throw new CommunityError('REWARD_NOT_REDEEMABLE', 'Esta recompensa não pode ser resgatada com pontos.')
  }

  const validatedReportsRequired = await readConfigValue('redemption_validated_reports', 2)
  const validatedReports = await getPrisma().report.count({
    where: { userId, status: 'RESOLVED' },
  })
  if (validatedReports < validatedReportsRequired) {
    throw new CommunityError(
      'VALIDATED_REPORTS_REQUIRED',
      `É preciso ter ao menos ${validatedReportsRequired} relatos validados para resgatar.`,
    )
  }

  try {
    return await getPrisma().$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.create({
        data: {
          userId,
          rewardKey: reward.key,
          pointsSpent: reward.value!,
          status: 'COMPLETED',
        },
        select: { id: true, rewardKey: true, pointsSpent: true },
      })
      const account = await debitPoints(
        {
          userId,
          amount: redemption.pointsSpent,
          reason: 'REDEMPTION',
          sourceType: 'RewardRedemption',
          sourceId: redemption.id,
        },
        tx,
      )
      return {
        redemptionId: redemption.id,
        rewardKey: redemption.rewardKey,
        pointsSpent: redemption.pointsSpent,
        balance: account.balance,
        accumulated: account.accumulated,
      }
    })
  } catch (error) {
    if (error instanceof PointsLedgerError && error.code === 'INSUFFICIENT_BALANCE') {
      throw new CommunityError('INSUFFICIENT_BALANCE', 'Saldo insuficiente para resgatar esta recompensa.')
    }
    throw error
  }
}

export async function getInvite(userId: string) {
  const inviteCode = await ensureUserInviteCode(userId)
  const inviteLimit = await readConfigValue('invite_reward_limit', 10)
  const attributions = await getPrisma().inviteAttribution.findMany({
    where: { inviterId: userId },
    select: {
      module0CompletedAt: true,
      pointsAwarded: true,
    },
  })

  return {
    inviteCode,
    inviteLimit,
    stats: {
      registeredCount: attributions.length,
      module0CompletedCount: attributions.filter((item) => item.module0CompletedAt).length,
      pointsFromInvites: attributions.reduce((sum, item) => sum + item.pointsAwarded, 0),
      rewardedInviteCount: attributions.filter((item) => item.pointsAwarded > 0).length,
    },
  }
}

export async function assignInvite(userId: string, inviteCode: string) {
  const existing = await getPrisma().inviteAttribution.findUnique({
    where: { inviteeId: userId },
    select: { inviteCode: true },
  })
  if (existing) {
    throw new CommunityError('INVITE_ALREADY_ATTRIBUTED', 'Este usuário já possui um convite atribuído.')
  }

  const inviter = await getPrisma().user.findFirst({
    where: { inviteCode: inviteCode.trim(), id: { not: userId } },
    select: { id: true },
  })
  if (!inviter) {
    throw new CommunityError('INVITE_INVALID', 'Código de convite inválido.')
  }

  await attributeInviteOnRegister(userId, inviteCode.trim())
  const attributed = await getPrisma().inviteAttribution.findUnique({
    where: { inviteeId: userId },
    select: { inviteCode: true },
  })
  return {
    attributed: Boolean(attributed),
    inviteCode: attributed?.inviteCode ?? null,
  }
}

export async function getProfile(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { name: true, neighborhood: true },
  })
  if (!user) throw new Error('Usuário não encontrado.')

  const account = await getOrCreatePointAccount(userId)
  const level = await resolveGuardianLevel(account.accumulated)

  const trails = await getPrisma().trail.findMany({
    where: publishedTrailWhere,
    select: {
      modules: {
        where: publishedModuleWhere,
        select: {
          id: true,
          progressRecords: {
            where: { userId, completedAt: { not: null } },
            select: { id: true },
          },
        },
      },
    },
  })
  const modulesPublished = trails.reduce((sum, trail) => sum + trail.modules.length, 0)
  const modulesCompleted = trails.reduce(
    (sum, trail) => sum + trail.modules.filter((module) => module.progressRecords.length > 0).length,
    0,
  )
  const reportsCount = await getPrisma().report.count({ where: { userId } })

  return {
    name: user.name,
    neighborhood: user.neighborhood,
    level: levelPayload(level),
    accumulated: account.accumulated,
    balance: account.balance,
    badges: {
      modulesCompleted,
      modulesPublished,
    },
    reportsCount,
    shortcuts: {
      ranking: '/ranking' as const,
      rewards: '/recompensas' as const,
      invite: '/convidar' as const,
      reports: '/relatos' as const,
    },
  }
}
