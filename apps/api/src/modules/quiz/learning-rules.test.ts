import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '../../generated/prisma/client.js'
import { assertMinimumTime, assertRetry, awardOnce, configuration, minimumCorrect, queueModuleAward, queueTrainingAward, releasePendingModules, creditGrantedLearningAward, reconcileLearningPoints, learningDayStart } from './learning-rules.service.js'

const now = new Date('2026-11-01T02:30:00Z')
type Award = { id: string; userId: string; ruleKey: string; sourceId: string; points: number; grantedAt: Date | null; createdAt: Date }
let rows: Award[]
let settings: Record<string, { kind: 'RULE' | 'LIMIT'; value: number | null; isActive: boolean }>
const db = {
  programConfiguration: { findUnique: vi.fn() },
  learningAward: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { findFirst: vi.fn(), create: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  trailModule: { findMany: vi.fn() },
  trail: { findMany: vi.fn() },
}
const tx = db as unknown as Prisma.TransactionClient
beforeEach(() => {
  vi.resetAllMocks()
  rows = []
  settings = {
    module_completion: { kind: 'RULE', value: 2, isActive: true },
    training_completion: { kind: 'RULE', value: 3, isActive: true },
    training_modules_daily: { kind: 'LIMIT', value: 2, isActive: true },
    training_points_daily: { kind: 'LIMIT', value: 4, isActive: true },
    module_minimum_time: { kind: 'LIMIT', value: 70, isActive: true },
    quiz_pass_score: { kind: 'LIMIT', value: 80, isActive: true },
    quiz_retry_interval: { kind: 'LIMIT', value: null, isActive: true },
  }
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => settings[where.key] ? { key: where.key, ...settings[where.key] } : null)
  const echoIds = async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id }))
  db.user.findMany.mockImplementation(echoIds)
  db.trailModule.findMany.mockImplementation(echoIds)
  db.trail.findMany.mockImplementation(echoIds)
  db.learningAward.findMany.mockImplementation(async ({ where }: {
    where: {
      ruleKey?: string | { in: string[] }
      grantedAt: null | { gte: Date; lt: Date }
      points?: { gt: number }
    }
  }) => {
    const ruleKeys = typeof where.ruleKey === 'string'
      ? [where.ruleKey]
      : where.ruleKey?.in
    return rows.filter(row => {
      if (ruleKeys && !ruleKeys.includes(row.ruleKey)) return false
      if (where.grantedAt === null) return !row.grantedAt
      if (where.points?.gt != null && !(row.points > where.points.gt)) return false
      return Boolean(row.grantedAt && row.grantedAt >= where.grantedAt.gte && row.grantedAt < where.grantedAt.lt)
    })
  })
  db.learningAward.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { grantedAt: Date } }) => {
    const row = rows.find(row => row.id === where.id)!
    row.grantedAt = data.grantedAt
    return row
  })
  db.learningAward.create.mockImplementation(async ({ data }: { data: Omit<Award, 'id' | 'createdAt'> }) => {
    const row = { ...data, id: String(rows.length), createdAt: now, grantedAt: data.grantedAt ?? null }
    rows.push(row)
    return row
  })
})

describe('conclusão de módulos v2', () => {
  it('reconcilia sete módulos em quatro dias mesmo sem abrir o aplicativo nos dias intermediários', async () => {
    for (const module of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) await queueModuleAward(tx, 'user', module, 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 4 })
    expect(await releasePendingModules(tx, 'user', new Date(now.getTime() + 3 * 86400000))).toEqual({ pointsReleased: 10 })
    expect(rows.filter(row => row.grantedAt)).toHaveLength(7)
    expect(await releasePendingModules(tx, 'user', new Date(now.getTime() + 3 * 86400000))).toEqual({ pointsReleased: 0 })
    expect(db.pointLedgerEntry.create).toHaveBeenCalledTimes(7)
    expect(db.pointAccount.update).toHaveBeenCalledTimes(7)
    const buckets = new Map<string, number>()
    for (const row of rows) { const day = new Date(row.grantedAt!.getTime() - 10800000).toISOString().slice(0, 10); buckets.set(day, (buckets.get(day) ?? 0) + row.points) }
    expect([...buckets.values()]).toEqual([4, 4, 4, 2])
  })
  it('concede somente dois módulos por dia e libera o excedente no dia seguinte', async () => {
    for (const module of ['a', 'b', 'c']) await queueModuleAward(tx, 'user', module, 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 4 })
    expect(rows.filter(row => row.grantedAt)).toHaveLength(2)
    expect(db.pointLedgerEntry.create).toHaveBeenCalledTimes(2)
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
    expect(await releasePendingModules(tx, 'user', new Date('2026-11-01T03:00:00Z'))).toEqual({ pointsReleased: 2 })
    expect(rows.every(row => row.grantedAt)).toBe(true)
  })
  it('respeita o teto de pontos mesmo com limite de módulos maior', async () => {
    settings.training_modules_daily!.value = 10
    settings.training_points_daily!.value = 3
    for (const module of ['a', 'b']) await queueModuleAward(tx, 'user', module, 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 2 })
  })
  it('mantém o valor aplicado na fila e usa os limites atuais na liberação', async () => {
    await queueModuleAward(tx, 'user', 'a', 'trail')
    settings.module_completion!.value = 9
    settings.training_points_daily!.value = 1
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
    settings.training_points_daily!.value = 4
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 2 })
  })
  it('não libera pontos com a regra desativada', async () => {
    await queueModuleAward(tx, 'user', 'a', 'trail')
    settings.module_completion!.isActive = false
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
  })
  it('não converte limite zero em ilimitado', async () => {
    settings.training_modules_daily!.value = 0
    await queueModuleAward(tx, 'user', 'a', 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
  })
  it('permite desativar os limites sem valores fixos alternativos', async () => {
    settings.training_modules_daily!.isActive = false
    settings.training_points_daily!.isActive = false
    for (const module of ['a', 'b', 'c']) await queueModuleAward(tx, 'user', module, 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 6 })
  })
  it('ignora limites diários quando POINTS_DAILY_LIMITS_ENABLED=false', async () => {
    const previous = process.env['POINTS_DAILY_LIMITS_ENABLED']
    process.env['POINTS_DAILY_LIMITS_ENABLED'] = 'false'
    try {
      settings.training_modules_daily!.value = 1
      settings.training_points_daily!.value = 2
      for (const module of ['a', 'b', 'c']) await queueModuleAward(tx, 'user', module, 'trail')
      expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 6 })
    } finally {
      if (previous === undefined) delete process.env['POINTS_DAILY_LIMITS_ENABLED']
      else process.env['POINTS_DAILY_LIMITS_ENABLED'] = previous
    }
  })
  it('claim/release no mesmo dia só libera o que cabe no teto', async () => {
    settings.training_points_daily!.value = 4
    settings.training_modules_daily!.value = 10
    for (const module of ['a', 'b', 'c']) await queueModuleAward(tx, 'user', module, 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 4 })
    expect(rows.filter((row) => row.grantedAt)).toHaveLength(2)
    expect(rows.filter((row) => !row.grantedAt)).toHaveLength(1)
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
    expect(await releasePendingModules(tx, 'user', new Date(now.getTime() + 86400000))).toEqual({ pointsReleased: 2 })
  })
  it('com teto 10 libera dois módulos completos (3+2) no mesmo dia sem pendência', async () => {
    settings.training_points_daily!.value = 10
    settings.training_modules_daily!.value = 2
    for (const module of ['m1', 'm2']) {
      await queueTrainingAward(tx, 'user', module, 'trail')
      await queueModuleAward(tx, 'user', module, 'trail')
    }
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 10 })
    expect(rows.every((row) => row.grantedAt)).toBe(true)
    expect(rows.reduce((sum, row) => sum + row.points, 0)).toBe(10)
  })
  it('libera training_completion na mesma fila de pontos diários', async () => {
    await queueTrainingAward(tx, 'user', 'm1', 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 3 })
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 3,
        reason: 'QUIZ_TRAINING',
        sourceType: 'LearningAward',
        sourceId: JSON.stringify(['user', 'training_completion', 'm1']),
      }),
    })
  })
  it('adia training_completion quando o teto diário de pontos já está cheio', async () => {
    settings.training_points_daily!.value = 4
    await queueModuleAward(tx, 'user', 'a', 'trail')
    await queueModuleAward(tx, 'user', 'b', 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 4 })
    await queueTrainingAward(tx, 'user', 'm1', 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
    expect(rows.filter(row => row.ruleKey === 'training_completion' && !row.grantedAt)).toHaveLength(1)
    expect(await releasePendingModules(tx, 'user', new Date(now.getTime() + 86400000))).toEqual({ pointsReleased: 3 })
  })
  it('adia em vez de descartar quando o award excede o teto diário', async () => {
    settings.training_points_daily!.value = 2
    await queueTrainingAward(tx, 'user', 'm1', 'trail')
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 0 })
    expect(rows.every(row => !row.grantedAt)).toBe(true)
    settings.training_points_daily!.value = 4
    expect(await releasePendingModules(tx, 'user', now)).toEqual({ pointsReleased: 3 })
  })
  it('exige 70% do tempo previsto, calculado no servidor', async () => {
    await expect(assertMinimumTime(tx, new Date(now.getTime() - 41999), 60, now)).rejects.toMatchObject({ code: 'MINIMUM_TIME_REQUIRED' })
    await expect(assertMinimumTime(tx, new Date(now.getTime() - 42000), 60, now)).resolves.toBeUndefined()
    await expect(assertMinimumTime(tx, now, 0, now)).resolves.toBeUndefined()
  })
  it('vira o dia dos limites em America/Sao_Paulo perto da meia-noite local', async () => {
    // 02:59 UTC ainda é 23:59 do dia anterior em São Paulo (UTC-3).
    const beforeMidnightSp = new Date('2026-11-01T02:59:59.999Z')
    // 03:00 UTC = 00:00 em São Paulo.
    const atMidnightSp = new Date('2026-11-01T03:00:00.000Z')
    expect(learningDayStart(beforeMidnightSp).toISOString()).toBe('2026-10-31T03:00:00.000Z')
    expect(learningDayStart(atMidnightSp).toISOString()).toBe('2026-11-01T03:00:00.000Z')

    settings.training_points_daily!.value = 2
    settings.training_modules_daily!.value = 10
    await queueModuleAward(tx, 'user', 'late', 'trail')
    expect(await releasePendingModules(tx, 'user', beforeMidnightSp)).toEqual({ pointsReleased: 2 })
    await queueModuleAward(tx, 'user', 'early', 'trail')
    // Ainda no mesmo dia SP: teto cheio.
    expect(await releasePendingModules(tx, 'user', beforeMidnightSp)).toEqual({ pointsReleased: 0 })
    // Após meia-noite SP: novo bucket.
    expect(await releasePendingModules(tx, 'user', atMidnightSp)).toEqual({ pointsReleased: 2 })
  })

  it('com limites atingidos às 23:50 SP libera pendentes após 00:00 local (fake timers)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 23:50 America/Sao_Paulo = 02:50 UTC do dia seguinte no calendário UTC.
    const at2350Sp = new Date('2026-11-01T02:50:00.000Z')
    vi.setSystemTime(at2350Sp)
    db.learningAward.create.mockImplementation(async ({ data }: { data: Omit<Award, 'id' | 'createdAt'> }) => {
      const row = { ...data, id: String(rows.length), createdAt: new Date(), grantedAt: data.grantedAt ?? null }
      rows.push(row)
      return row
    })

    settings.training_points_daily!.value = 2
    settings.training_modules_daily!.value = 10
    await queueModuleAward(tx, 'user', 'evening', 'trail')
    expect(await releasePendingModules(tx, 'user', new Date())).toEqual({ pointsReleased: 2 })
    await queueModuleAward(tx, 'user', 'pending', 'trail')
    expect(await releasePendingModules(tx, 'user', new Date())).toEqual({ pointsReleased: 0 })
    expect(rows.filter((row) => !row.grantedAt)).toHaveLength(1)

    // Avança 10 minutos: 00:00 America/Sao_Paulo.
    vi.setSystemTime(new Date('2026-11-01T03:00:00.000Z'))
    expect(await releasePendingModules(tx, 'user', new Date())).toEqual({ pointsReleased: 2 })
    expect(rows.every((row) => row.grantedAt)).toBe(true)
    vi.useRealTimers()
  })
})

it('aplica aprovação administrativa e não usa 70% como fallback', async () => {
  expect(await minimumCorrect(tx, 3)).toBe(3)
  expect(await minimumCorrect(tx, 10)).toBe(8)
  settings.quiz_pass_score!.value = 90
  expect(await minimumCorrect(tx, 10)).toBe(9)
  settings.quiz_pass_score!.isActive = false
  expect(await minimumCorrect(tx, 10)).toBe(0)
})

it('trata ausência e valor pendente como configuração incompleta', async () => {
  await expect(configuration(tx, 'missing', 'RULE')).rejects.toMatchObject({ code: 'LEARNING_CONFIGURATION_PENDING' })
  await expect(assertRetry(tx, now, now)).rejects.toMatchObject({ code: 'LEARNING_CONFIGURATION_PENDING' })
  await expect(assertRetry(tx, null, now)).resolves.toBeUndefined()
  settings.quiz_retry_interval!.value = 60
  await expect(assertRetry(tx, now, now)).rejects.toMatchObject({ code: 'RETRY_NOT_AVAILABLE' })
  await expect(assertRetry(tx, new Date(now.getTime() - 59999), now)).rejects.toMatchObject({ message: 'Aguarde 1 segundo para tentar novamente. Você pode revisar o conteúdo enquanto isso.' })
  await expect(assertRetry(tx, new Date(now.getTime() - 60000), now)).resolves.toBeUndefined()
})

it('permite tentar novamente no limite exato de 30 segundos e respeita intervalo desativado', async () => {
  settings.quiz_retry_interval!.value = 30
  await expect(assertRetry(tx, new Date(now.getTime() - 29000), now)).rejects.toMatchObject({ code: 'RETRY_NOT_AVAILABLE' })
  await expect(assertRetry(tx, new Date(now.getTime() - 30000), now)).resolves.toBeUndefined()
  settings.quiz_retry_interval!.isActive = false
  await expect(assertRetry(tx, now, now)).resolves.toBeUndefined()
})

it('evita repetir uma concessão registrada e respeita regra inativa', async () => {
  db.learningAward.findUnique.mockResolvedValue({ points: 2 })
  expect(await awardOnce(tx, { userId: 'user', ruleKey: 'module_completion', sourceId: 'module' }, now)).toBe(0)
  expect(db.learningAward.create).not.toHaveBeenCalled()
})

describe('crédito de aprendizagem no extrato geral', () => {
  const award = { userId: 'user', ruleKey: 'module_completion', sourceId: 'module', points: 2, grantedAt: now }
  it('credita saldo e acumulado com uma identidade única por usuário e recompensa', async () => {
    expect(await creditGrantedLearningAward(tx, award)).toBe(2)
    expect(db.pointLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user', delta: 2, reason: 'QUIZ_TRAINING', sourceType: 'LearningAward', sourceId: JSON.stringify(['user', 'module_completion', 'module']) }) })
    expect(db.pointAccount.update).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { increment: 2 }, accumulated: { increment: 2 } } }))
    db.pointLedgerEntry.findFirst.mockResolvedValue({ userId: 'user', delta: 2 })
    expect(await creditGrantedLearningAward(tx, award)).toBe(0)
    expect(db.pointAccount.update).toHaveBeenCalledTimes(1)
  })
  it('não credita pontos pendentes ou zero', async () => {
    expect(await creditGrantedLearningAward(tx, { ...award, grantedAt: null })).toBe(0)
    expect(await creditGrantedLearningAward(tx, { ...award, points: 0 })).toBe(0)
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
  it('propaga falhas de crédito para reverter a transação de aprendizagem', async () => {
    db.pointAccount.update.mockRejectedValue(new Error('falha na conta'))
    await expect(creditGrantedLearningAward(tx, award)).rejects.toThrow('falha na conta')
  })
  it('reconcilia apenas recompensas concedidas e não duplica lançamentos existentes', async () => {
    db.learningAward.findMany.mockResolvedValue([award])
    expect(await reconcileLearningPoints(tx)).toEqual({ awardsChecked: 1, pointsCredited: 2 })
    expect(db.learningAward.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { grantedAt: { not: null }, points: { gt: 0 } } }))
    db.pointLedgerEntry.findFirst.mockImplementation(async ({ where }: { where: { sourceType: unknown } }) => where.sourceType === 'LearningAward' ? { userId: 'user', delta: 2 } : null)
    expect(await reconcileLearningPoints(tx)).toEqual({ awardsChecked: 1, pointsCredited: 0 })
    expect(db.pointAccount.update).toHaveBeenCalledTimes(1)
  })
  it('pula award de usuário inexistente sem apagar o registro', async () => {
    db.learningAward.findMany.mockResolvedValue([{ ...award, id: 'award-orphan' }])
    db.user.findMany.mockResolvedValue([])
    expect(await reconcileLearningPoints(tx)).toEqual({ awardsChecked: 1, pointsCredited: 0 })
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
  it('aborta diante de créditos legados para não duplicar valores já pagos', async () => {
    db.learningAward.findMany.mockResolvedValue([award])
    db.pointLedgerEntry.findFirst.mockResolvedValue({ id: 'legacy' })
    await expect(reconcileLearningPoints(tx)).rejects.toThrow('créditos legados')
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
})
