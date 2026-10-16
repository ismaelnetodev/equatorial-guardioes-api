import { publishedTrailWhere, publishedModuleWhere } from '../../lib/content-visibility.js'
import { getPrisma } from '../../lib/prisma.js'
import { getAuthenticatedUser } from '../../lib/auth-user.js'
import { getModuleStatus } from '../../lib/module-status.js'
import type { Trail, TrailDetails, TrailModule } from './trails.schemas.js'

export class TrailNotFoundError extends Error {
  constructor() { super('Trilha não encontrada.') }
}

const trailSelect = { id: true, title: true, description: true } as const
const trailModuleSelect = { id: true, title: true, description: true, content: true, order: true, durationMinutes: true, isActive: true } as const

export async function listTrails(): Promise<Trail[]> {
  return getPrisma().trail.findMany({ where: publishedTrailWhere, select: trailSelect, orderBy: { order: 'asc' } })
}

export async function getTrail(trailId: string, authorization?: string): Promise<TrailDetails> {
  const viewer = authorization === undefined ? undefined : await getAuthenticatedUser(authorization)
  const isAdmin = viewer?.role === 'ADMIN'
  const trail = await getPrisma().trail.findUnique({
    where: { id: trailId, ...(isAdmin ? {} : publishedTrailWhere) },
    select: { ...trailSelect, modules: {
      where: isAdmin ? {} : publishedModuleWhere,
      select: { ...trailModuleSelect, progressRecords: {
        where: { userId: viewer?.id ?? '00000000-0000-0000-0000-000000000000' },
        select: { completedAt: true }, take: 1,
      } }, orderBy: { order: 'asc' },
    } },
  })
  if (!trail) throw new TrailNotFoundError()
  let previousCompleted = true
  const modules = trail.modules.map(({ progressRecords, content, ...module }): TrailModule => {
    const status = isAdmin ? 'available' : viewer ? getModuleStatus(progressRecords[0], previousCompleted) : 'blocked'
    if (module.isActive) previousCompleted = previousCompleted && status === 'completed'
    return { ...module, status, content: status === 'blocked' ? null : content }
  })
  return { ...trail, modules }
}

export async function listTrailModules(trailId: string, authorization?: string): Promise<TrailModule[]> {
  return (await getTrail(trailId, authorization)).modules
}
