import { getPrisma } from '../../lib/prisma.js'
import type { Trail, TrailDetails, TrailModule } from './trails.schemas.js'

export class TrailNotFoundError extends Error {
  constructor() { super('Trilha não encontrada.') }
}

const trailSelect = { id: true, title: true, description: true } as const
const trailModuleSelect = { id: true, title: true, description: true, content: true, order: true, durationMinutes: true, isActive: true } as const

export async function listTrails(): Promise<Trail[]> {
  return getPrisma().trail.findMany({ select: trailSelect, orderBy: { title: 'asc' } })
}

export async function getTrail(trailId: string): Promise<TrailDetails> {
  const trail = await getPrisma().trail.findUnique({
    where: { id: trailId },
    select: { ...trailSelect, modules: { select: trailModuleSelect, orderBy: { order: 'asc' } } },
  })
  if (!trail) throw new TrailNotFoundError()
  return trail
}

export async function listTrailModules(trailId: string): Promise<TrailModule[]> {
  const trail = await getPrisma().trail.findUnique({ where: { id: trailId }, select: { id: true } })
  if (!trail) throw new TrailNotFoundError()
  return getPrisma().trailModule.findMany({ where: { trailId }, select: trailModuleSelect, orderBy: { order: 'asc' } })
}
