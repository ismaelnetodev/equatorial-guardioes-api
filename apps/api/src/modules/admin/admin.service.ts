import { Prisma } from '../../generated/prisma/client.js'
import { getPrisma } from '../../lib/prisma.js'
import { getAuthenticatedUser } from '../../lib/auth-user.js'
import { publishedModuleWhere } from '../../lib/content-visibility.js'
import type { ContentStatus, CreateTrail, UpdateTrail, CreateModule, UpdateModule } from './admin.schemas.js'

export class AdminError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'TRAIL_NOT_FOUND' | 'MODULE_NOT_FOUND' | 'INVALID_ORDER' | 'INVALID_PUBLICATION' | 'CONTENT_CONFLICT', message: string) { super(message) }
}

export async function authorizeAdministrator(authorization: string | undefined): Promise<void> {
  const user = await getAuthenticatedUser(authorization)
  if (user.role !== 'ADMIN') throw new AdminError('FORBIDDEN', 'Acesso permitido apenas a administradores.')
}

const trailSelect = { id: true, title: true, description: true, order: true, publicationStatus: true } as const
const moduleSelect = { id: true, trailId: true, title: true, description: true, content: true, order: true, publicationStatus: true, durationMinutes: true, isActive: true, requiresQuiz: true } as const

async function writeContent<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await getPrisma().$transaction(operation, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2003', 'P2034'].includes(error.code)) throw new AdminError('CONTENT_CONFLICT', 'O conteúdo foi alterado simultaneamente ou possui referências conflitantes. Atualize os dados e tente novamente.')
      if (error.code === 'P2025') throw new AdminError('CONTENT_CONFLICT', 'O conteúdo não está mais disponível. Atualize os dados e tente novamente.')
    }
    throw error
  }
}

async function requireTrail(db: Prisma.TransactionClient, trailId: string) {
  const trail = await db.trail.findUnique({ where: { id: trailId }, select: trailSelect })
  if (!trail) throw new AdminError('TRAIL_NOT_FOUND', 'Trilha não encontrada.')
  return trail
}

async function requireModule(db: Prisma.TransactionClient, trailId: string, moduleId: string) {
  await requireTrail(db, trailId)
  const module = await db.trailModule.findUnique({ where: { id: moduleId, trailId }, select: moduleSelect })
  if (!module) throw new AdminError('MODULE_NOT_FOUND', 'Módulo não encontrado nesta trilha.')
  return module
}

function nextOrder(max: number | null, count = 1): number {
  const next = (max ?? 0) + 1
  if (next + count - 1 > 2147483647) throw new AdminError('INVALID_ORDER', 'A coleção excedeu o limite de ordenação.')
  return next
}

function validateOrder(ids: string[], existing: { id: string }[]): void {
  const requested = new Set(ids)
  if (requested.size !== ids.length || ids.length !== existing.length || existing.some(item => !requested.has(item.id))) {
    throw new AdminError('INVALID_ORDER', 'Informe todos os IDs da coleção, sem repetições ou itens de outra coleção.')
  }
}

export async function listAdminTrails() {
  return getPrisma().trail.findMany({ select: trailSelect, orderBy: { order: 'asc' } })
}

export async function getAdminTrail(trailId: string) {
  const trail = await getPrisma().trail.findUnique({ where: { id: trailId }, select: { ...trailSelect, modules: { select: moduleSelect, orderBy: { order: 'asc' } } } })
  if (!trail) throw new AdminError('TRAIL_NOT_FOUND', 'Trilha não encontrada.')
  return trail
}

export async function createTrail(input: CreateTrail) {
  return writeContent(async tx => {
    const aggregate = await tx.trail.aggregate({ _max: { order: true } })
    return tx.trail.create({ data: { title: input.title.trim(), description: input.description.trim(), order: nextOrder(aggregate._max.order) }, select: trailSelect })
  })
}

export async function updateTrail(trailId: string, input: UpdateTrail) {
  return writeContent(async tx => {
    await requireTrail(tx, trailId)
    return tx.trail.update({ where: { id: trailId }, data: { ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.description !== undefined ? { description: input.description.trim() } : {}) }, select: trailSelect })
  })
}

export async function changeTrailStatus(trailId: string, status: ContentStatus) {
  return writeContent(async tx => {
    const trail = await requireTrail(tx, trailId)
    if (status === 'PUBLISHED') {
      const count = await tx.trailModule.count({ where: { trailId, ...publishedModuleWhere } })
      if (!trail.title.trim() || !trail.description.trim() || count === 0) throw new AdminError('INVALID_PUBLICATION', 'Uma trilha publicada precisa de título, descrição e ao menos um módulo publicado.')
    }
    return tx.trail.update({ where: { id: trailId }, data: { publicationStatus: status }, select: trailSelect })
  })
}

export async function reorderTrails(ids: string[]) {
  return writeContent(async tx => {
    const existing = await tx.trail.findMany({ select: { id: true, order: true } })
    validateOrder(ids, existing)
    const temporaryStart = nextOrder(existing.reduce((max, item) => Math.max(max, item.order), 0), ids.length)
    // Duas etapas evitam colisões dos índices únicos durante trocas de posição.
    for (const [index, id] of ids.entries()) await tx.trail.update({ where: { id }, data: { order: temporaryStart + index } })
    for (const [index, id] of ids.entries()) await tx.trail.update({ where: { id }, data: { order: index + 1 } })
    return tx.trail.findMany({ select: trailSelect, orderBy: { order: 'asc' } })
  })
}

export async function createModule(trailId: string, input: CreateModule) {
  return writeContent(async tx => {
    await requireTrail(tx, trailId)
    const aggregate = await tx.trailModule.aggregate({ where: { trailId }, _max: { order: true } })
    return tx.trailModule.create({ data: { trailId, title: input.title.trim(), description: input.description.trim(), content: input.content ?? '', durationMinutes: input.durationMinutes ?? null, requiresQuiz: input.requiresQuiz ?? false, order: nextOrder(aggregate._max.order) }, select: moduleSelect })
  })
}

export async function updateModule(trailId: string, moduleId: string, input: UpdateModule) {
  return writeContent(async tx => {
    const module = await requireModule(tx, trailId, moduleId)
    if (module.publicationStatus === 'PUBLISHED' && input.content !== undefined && !input.content.trim()) throw new AdminError('INVALID_PUBLICATION', 'Um módulo publicado precisa de conteúdo.')
    const data = { ...input, ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.description !== undefined ? { description: input.description.trim() } : {}) }
    return tx.trailModule.update({ where: { id: moduleId }, data, select: moduleSelect })
  })
}

export async function changeModuleStatus(trailId: string, moduleId: string, status: ContentStatus) {
  return writeContent(async tx => {
    const module = await requireModule(tx, trailId, moduleId)
    if (status === 'PUBLISHED' && (!module.title.trim() || !module.description.trim() || !module.content.trim())) throw new AdminError('INVALID_PUBLICATION', 'Um módulo publicado precisa de título, descrição e conteúdo.')
    if (module.publicationStatus === 'PUBLISHED' && module.isActive && status !== 'PUBLISHED') {
      const trail = await requireTrail(tx, trailId)
      if (trail.publicationStatus === 'PUBLISHED') {
        const remaining = await tx.trailModule.count({ where: { trailId, ...publishedModuleWhere, id: { not: moduleId } } })
        if (remaining === 0) throw new AdminError('INVALID_PUBLICATION', 'Altere primeiro o estado da trilha antes de retirar seu último módulo publicado.')
      }
    }
    return tx.trailModule.update({ where: { id: moduleId }, data: { publicationStatus: status, isActive: status !== 'DISABLED' }, select: moduleSelect })
  })
}

export async function reorderModules(trailId: string, ids: string[]) {
  return writeContent(async tx => {
    await requireTrail(tx, trailId)
    const existing = await tx.trailModule.findMany({ where: { trailId }, select: { id: true, order: true } })
    validateOrder(ids, existing)
    const temporaryStart = nextOrder(existing.reduce((max, item) => Math.max(max, item.order), 0), ids.length)
    for (const [index, id] of ids.entries()) await tx.trailModule.update({ where: { id }, data: { order: temporaryStart + index } })
    for (const [index, id] of ids.entries()) await tx.trailModule.update({ where: { id }, data: { order: index + 1 } })
    return tx.trailModule.findMany({ where: { trailId }, select: moduleSelect, orderBy: { order: 'asc' } })
  })
}
