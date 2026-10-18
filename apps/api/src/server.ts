import 'dotenv/config'
import process from 'node:process'
import { buildApp } from './app.js'
import { pointsQueueIntervalMs } from './lib/points-limits.js'
import { releaseAllPendingLearningAwards } from './lib/release-pending-points.js'

async function main() {
  const app = await buildApp()
  const port = Number(process.env['PORT'] ?? 3000)

  const host = process.env['HOST'] ?? '0.0.0.0'
  await app.listen({ port, host })

  const queueIntervalMs = pointsQueueIntervalMs()
  let queueTimer: ReturnType<typeof setInterval> | undefined
  if (queueIntervalMs > 0) {
    queueTimer = setInterval(() => {
      void releaseAllPendingLearningAwards().catch((error) => {
        app.log.error({ err: error }, 'failed to release pending learning awards')
      })
    }, queueIntervalMs)
    queueTimer.unref?.()
  }

  const close = async () => {
    if (queueTimer) clearInterval(queueTimer)
    await app.close()
    process.exit(0)
  }
  process.once('SIGINT', () => {
    void close()
  })
  process.once('SIGTERM', () => {
    void close()
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
