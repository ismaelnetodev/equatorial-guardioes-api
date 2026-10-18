import 'dotenv/config'
import { Prisma } from '../generated/prisma/client.js'
import { getPrisma } from '../lib/prisma.js'
import { reconcileLearningPoints } from '../modules/quiz/learning-rules.service.js'

const db = getPrisma()
try {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await db.$transaction(reconcileLearningPoints, { isolationLevel: 'Serializable', timeout: 120000 })
      console.log(JSON.stringify(result))
      break
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error
    }
  }
} finally { await db.$disconnect() }
