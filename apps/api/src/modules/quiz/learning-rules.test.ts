import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '../../generated/prisma/client.js'
import { assertMinimumTime, assertRetry, awardOnce, configuration, minimumCorrect, queueModuleAward, releasePendingModules, creditGrantedLearningAward, reconcileLearningPoints } from './learning-rules.service.js'

const now = new Date('2026-11-01T02:30:00Z')
type Award = { id: string; userId: string; ruleKey: string; sourceId: string; points: number; grantedAt: Date | null; createdAt: Date }
let rows: Award[]
let settings: Record<string, { kind: 'RULE' | 'LIMIT'; value: number | null; isActive: boolean }>
const db = {
  programConfiguration: { findUnique: vi.fn() },
  learningAward: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  pointLedgerEntry: { findFirst: vi.fn(), create: vi.fn() },
  pointAccount: { upsert: vi.fn(), update: vi.fn() },
}
const tx = db as unknown as Prisma.TransactionClient
beforeEach(() => {
  vi.resetAllMocks()
  rows = []
  settings = {
    module_completion: { kind: 'RULE', value: 2, isActive: true },
    training_modules_daily: { kind: 'LIMIT', value: 2, isActive: true },
    training_points_daily: { kind: 'LIMIT', value: 4, isActive: true },
    module_minimum_time: { kind: 'LIMIT', value: 70, isActive: true },
    quiz_pass_score: { kind: 'LIMIT', value: 80, isActive: true },
    quiz_retry_interval: { kind: 'LIMIT', value: null, isActive: true },
  }
  db.programConfiguration.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => settings[where.key] ? { key: where.key, ...settings[where.key] } : null)
  db.learningAward.findMany.mockImplementation(async ({ where }: { where: { grantedAt: null | { gte: Date; lt: Date } } }) => rows.filter(row => where.grantedAt === null ? !row.grantedAt : row.points > 0 && row.grantedAt && row.grantedAt >= where.grantedAt.gte && row.grantedAt < where.grantedAt.lt))
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
  it('exige 70% do tempo previsto, calculado no servidor', async () => {
    await expect(assertMinimumTime(tx, new Date(now.getTime() - 41999), 60, now)).rejects.toMatchObject({ code: 'MINIMUM_TIME_REQUIRED' })
    await expect(assertMinimumTime(tx, new Date(now.getTime() - 42000), 60, now)).resolves.toBeUndefined()
    await expect(assertMinimumTime(tx, now, 0, now)).resolves.toBeUndefined()
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
  it('aborta diante de créditos legados para não duplicar valores já pagos', async () => {
    db.learningAward.findMany.mockResolvedValue([award])
    db.pointLedgerEntry.findFirst.mockResolvedValue({ id: 'legacy' })
    await expect(reconcileLearningPoints(tx)).rejects.toThrow('créditos legados')
    expect(db.pointLedgerEntry.create).not.toHaveBeenCalled()
  })
})
