import 'dotenv/config'
import { getPrisma } from '../lib/prisma.js'
import { Prisma } from '../generated/prisma/client.js'
import { updateGuardioesModules } from './update-guardioes-modules.js'

const db = getPrisma()
try {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await db.$transaction(updateGuardioesModules, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 120000 })
      console.log(JSON.stringify(result))
      break
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error
    }
  }
} finally {
  await db.$disconnect()
}
