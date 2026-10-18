import { publishedModuleWhere, publishedTrailWhere } from './content-visibility.js'
import { getPrisma } from './prisma.js'

/**
 * Single configurable gate: reports unlock after the user completes the initial
 * trail module (module 0 / first published module of the first published trail).
 */
export const REPORTS_UNLOCK_AFTER_INITIAL_MODULE = true

export async function hasCompletedInitialModule(userId: string): Promise<boolean> {
  if (!REPORTS_UNLOCK_AFTER_INITIAL_MODULE) return true

  const trail = await getPrisma().trail.findFirst({
    where: publishedTrailWhere,
    orderBy: { order: 'asc' },
    select: {
      modules: {
        where: publishedModuleWhere,
        orderBy: { order: 'asc' },
        take: 1,
        select: {
          id: true,
          progressRecords: {
            where: { userId },
            select: { completedAt: true },
          },
        },
      },
    },
  })
  return Boolean(trail?.modules[0]?.progressRecords?.[0]?.completedAt)
}

export async function canReport(userId: string): Promise<boolean> {
  return hasCompletedInitialModule(userId)
}
