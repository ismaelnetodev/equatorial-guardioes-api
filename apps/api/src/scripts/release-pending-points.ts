import 'dotenv/config'
import { Prisma } from '../generated/prisma/client.js'
import { getPrisma } from '../lib/prisma.js'
import { releaseAllPendingLearningAwards } from '../lib/release-pending-points.js'

try {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await releaseAllPendingLearningAwards()
      console.log(JSON.stringify(result))
      break
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= 2
      ) {
        throw error
      }
    }
  }
} finally {
  await getPrisma().$disconnect()
}
