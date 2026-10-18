import { describe, expect, it } from 'vitest'
import { arePointsDailyLimitsEnabled, pointsQueueIntervalMs } from './points-limits.js'

describe('points-limits env', () => {
  it('habilita limites por padrão', () => {
    expect(arePointsDailyLimitsEnabled({})).toBe(true)
  })
  it('desativa com false ou 0', () => {
    expect(arePointsDailyLimitsEnabled({ POINTS_DAILY_LIMITS_ENABLED: 'false' })).toBe(false)
    expect(arePointsDailyLimitsEnabled({ POINTS_DAILY_LIMITS_ENABLED: '0' })).toBe(false)
  })
  it('usa 1h como intervalo padrão e aceita 0 para desligar', () => {
    expect(pointsQueueIntervalMs({})).toBe(3_600_000)
    expect(pointsQueueIntervalMs({ POINTS_QUEUE_INTERVAL_MS: '0' })).toBe(0)
    expect(pointsQueueIntervalMs({ POINTS_QUEUE_INTERVAL_MS: '5000' })).toBe(5000)
  })
})
