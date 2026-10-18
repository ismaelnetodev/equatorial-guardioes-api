/** When false/0, training daily limits are ignored (demo). Default: enabled. */
export function arePointsDailyLimitsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env['POINTS_DAILY_LIMITS_ENABLED']
  if (raw === undefined || raw === '') return true
  return !['0', 'false', 'FALSE', 'no', 'NO', 'off', 'OFF'].includes(raw)
}

/** In-process queue poll interval. Default 1h. Set 0 to disable. */
export function pointsQueueIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env['POINTS_QUEUE_INTERVAL_MS']
  if (raw === undefined || raw === '') return 3_600_000
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 3_600_000
  return Math.floor(parsed)
}
