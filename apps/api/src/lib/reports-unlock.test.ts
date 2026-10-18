import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canReport, hasCompletedInitialModule } from './reports-unlock.js'

const db = vi.hoisted(() => ({
  trail: { findFirst: vi.fn() },
}))
vi.mock('./prisma.js', () => ({ getPrisma: () => db }))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('reports unlock', () => {
  it('bloqueia relatos antes de concluir o módulo inicial', async () => {
    db.trail.findFirst.mockResolvedValue({
      modules: [{ id: 'm0', progressRecords: [] }],
    })
    await expect(hasCompletedInitialModule('user-1')).resolves.toBe(false)
    await expect(canReport('user-1')).resolves.toBe(false)
  })

  it('libera relatos após concluir o módulo inicial', async () => {
    db.trail.findFirst.mockResolvedValue({
      modules: [{ id: 'm0', progressRecords: [{ completedAt: new Date() }] }],
    })
    await expect(hasCompletedInitialModule('user-1')).resolves.toBe(true)
    await expect(canReport('user-1')).resolves.toBe(true)
  })
})
