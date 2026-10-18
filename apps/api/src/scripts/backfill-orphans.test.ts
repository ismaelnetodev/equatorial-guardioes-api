import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  programConfiguration: { findUnique: vi.fn() },
  quizAttempt: { findMany: vi.fn() },
  moduleProgress: { findMany: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  trailModule: { findUnique: vi.fn() },
  trail: { findUnique: vi.fn() },
  learningAward: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $disconnect: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({ getPrisma: () => db }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  db.programConfiguration.findUnique.mockResolvedValue({ kind: 'RULE', isActive: true, value: 3 })
  db.quizAttempt.findMany.mockResolvedValue([{ id: 'attempt', progressId: 'progress', pointsAwarded: 0 }])
  db.moduleProgress.findMany.mockResolvedValue([{ id: 'progress', userId: 'user', moduleId: 'module', trainingPointsAwarded: 0 }])
  db.moduleProgress.findUnique.mockResolvedValue({ userId: 'user', moduleId: 'module' })
  db.user.findUnique.mockResolvedValue({ id: 'user' })
  db.trailModule.findUnique.mockResolvedValue({ id: 'module', trailId: 'trail' })
  db.trail.findUnique.mockResolvedValue({ id: 'trail' })
})

afterEach(() => vi.restoreAllMocks())

describe('backfills com relações ausentes', () => {
  it('ignora tentativa sem progresso antes de consultar o módulo', async () => {
    db.moduleProgress.findUnique.mockResolvedValue(null)
    await import('./backfill-module-quiz-awards.js')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missingProgress=progress'))
    expect(db.trailModule.findUnique).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.$disconnect).toHaveBeenCalledOnce()
  })

  it.each(['quiz', 'training'] as const)('ignora módulo ausente no backfill %s', async (kind) => {
    db.trailModule.findUnique.mockResolvedValue(null)
    if (kind === 'quiz') await import('./backfill-module-quiz-awards.js')
    else await import('./backfill-training-awards.js')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missingModule=module'))
    expect(db.trail.findUnique).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.$disconnect).toHaveBeenCalledOnce()
  })

  it.each(['quiz', 'training'] as const)('ignora trilha ausente no backfill %s', async (kind) => {
    db.trail.findUnique.mockResolvedValue(null)
    if (kind === 'quiz') await import('./backfill-module-quiz-awards.js')
    else await import('./backfill-training-awards.js')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('missingTrail=trail'))
    expect(db.learningAward.findUnique).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.$disconnect).toHaveBeenCalledOnce()
  })

  it.each(['quiz', 'training'] as const)('continua após órfão no backfill %s', async (kind) => {
    db.trailModule.findUnique.mockResolvedValueOnce(null)
    db.learningAward.findUnique.mockResolvedValue({ id: 'existing-award' })
    if (kind === 'quiz') {
      db.quizAttempt.findMany.mockResolvedValue([
        { id: 'orphan', progressId: 'missing-module-progress', pointsAwarded: 0 },
        { id: 'valid', progressId: 'progress', pointsAwarded: 0 },
      ])
      await import('./backfill-module-quiz-awards.js')
    } else {
      db.moduleProgress.findMany.mockResolvedValue([
        { id: 'orphan', userId: 'user', moduleId: 'missing-module', trainingPointsAwarded: 0 },
        { id: 'valid', userId: 'user', moduleId: 'module', trainingPointsAwarded: 0 },
      ])
      await import('./backfill-training-awards.js')
    }
    expect(db.learningAward.findUnique).toHaveBeenCalledOnce()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.$disconnect).toHaveBeenCalledOnce()
  })
})
