import { reportPhotoUrl, validateReportPhoto } from './report-photo.service.js'
import { Prisma } from '../../generated/prisma/client.js'
import { creditPoints } from '../../lib/points-ledger.js'
import { getPrisma } from '../../lib/prisma.js'
import { canReport } from '../../lib/reports-unlock.js'
import type {
  AdminReportStatusBody,
  CreateReport,
  ReportStatusCode,
  ReportUrgencyCode,
} from './reports.schemas.js'


const STATUS_META: Record<ReportStatusCode, { label: string; iconHint: string }> = {
  SENT: { label: 'Enviado', iconHint: 'check' },
  RECEIVED: { label: 'Recebido', iconHint: 'check' },
  IN_ANALYSIS: { label: 'Em análise', iconHint: 'clock' },
  RESOLVED: { label: 'Resolvido', iconHint: 'check' },
  NOT_CONFIRMED: { label: 'Não confirmado', iconHint: 'info' },
}

const URGENCY_META: Record<ReportUrgencyCode, { label: string; iconHint: string }> = {
  LOW: { label: 'Urgência baixa', iconHint: 'warning' },
  MEDIUM: { label: 'Urgência média', iconHint: 'warning' },
  HIGH: { label: 'Urgência alta', iconHint: 'warning' },
}

const TIMELINE_ORDER: ReportStatusCode[] = ['SENT', 'RECEIVED', 'IN_ANALYSIS', 'RESOLVED']

export class ReportError extends Error {
  constructor(
    public readonly code:
      | 'REPORTS_LOCKED'
      | 'REPORT_NOT_FOUND'
      | 'IMPACT_NOT_AVAILABLE'
      | 'INVALID_STATUS_TRANSITION'
      | 'REPORT_CONFLICT'
      | 'INVALID_NEIGHBORHOOD',
    message: string,
  ) {
    super(message)
  }
}

function statusView(code: ReportStatusCode) {
  return { code, ...STATUS_META[code] }
}

function urgencyView(code: ReportUrgencyCode) {
  return { code, ...URGENCY_META[code] }
}

function pointsHint(pointsAwarded: number, status: ReportStatusCode): string {
  if (status === 'NOT_CONFIRMED') return 'Relato não confirmado: sem pontos.'
  if (status === 'RESOLVED') return pointsAwarded + ' pts concedidos após validação.'
  return 'Pontos após validação da equipe, conforme risco e limites.'
}

export async function assertModuleZeroCompleted(userId: string): Promise<void> {
  if (!(await canReport(userId))) {
    throw new ReportError('REPORTS_LOCKED', 'Conclua o primeiro módulo para liberar os relatos.')
  }
}

function buildTimeline(
  current: ReportStatusCode,
  events: Array<{ status: ReportStatusCode; occurredAt: Date }>,
) {
  const byStatus = new Map(events.map((event) => [event.status, event.occurredAt]))
  if (current === 'NOT_CONFIRMED') {
    return events
      .slice()
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((event) => ({
        status: statusView(event.status),
        occurredAt: event.occurredAt.toISOString(),
        pending: false,
      }))
  }

  return TIMELINE_ORDER.map((code) => {
    const occurredAt = byStatus.get(code)
    const reachedIndex = TIMELINE_ORDER.indexOf(current)
    const codeIndex = TIMELINE_ORDER.indexOf(code)
    const pending = codeIndex > reachedIndex
    return {
      status: statusView(code),
      occurredAt: occurredAt ? occurredAt.toISOString() : null,
      pending,
    }
  })
}

async function toListItem(report: {
  id: string
  title: string
  address: string
  neighborhood: string
  photoUrl: string | null
  status: ReportStatusCode
  urgency: ReportUrgencyCode
  pointsAwarded: number
  submittedAt: Date
}) {
  return {
    id: report.id,
    title: report.title,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: await reportPhotoUrl(report.photoUrl),
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    submittedAt: report.submittedAt.toISOString(),
  }
}

async function findCatalogNeighborhoodById(id: string) {
  const catalog = await getPrisma().neighborhood.findUnique({ where: { id } })
  if (!catalog || catalog.municipalityCode !== '2111300') {
    throw new ReportError('INVALID_NEIGHBORHOOD', 'Selecione um bairro de São Luís ou informe Outro bairro.')
  }
  return { id: catalog.id, name: catalog.name }
}

async function findCatalogNeighborhoodByName(name: string) {
  const catalog = await getPrisma().neighborhood.findFirst({
    where: {
      municipalityCode: '2111300',
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  })
  if (!catalog) {
    throw new ReportError('INVALID_NEIGHBORHOOD', 'Selecione um bairro de São Luís ou informe Outro bairro.')
  }
  return catalog
}

async function resolveReportNeighborhood(
  userId: string,
  input: Pick<CreateReport, 'neighborhood' | 'neighborhoodId'>,
): Promise<{ id: string; name: string }> {
  if (input.neighborhoodId) {
    return findCatalogNeighborhoodById(input.neighborhoodId)
  }

  const provided = input.neighborhood?.trim() ?? ''
  if (provided.length >= 2) {
    return findCatalogNeighborhoodByName(provided)
  }

  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { neighborhood: true, neighborhoodId: true },
  })
  if (user?.neighborhoodId) {
    return findCatalogNeighborhoodById(user.neighborhoodId)
  }
  const fallback = user?.neighborhood?.trim() ?? ''
  if (fallback.length < 2) {
    throw new ReportError('INVALID_NEIGHBORHOOD', 'Informe o bairro do relato ou atualize o bairro do seu cadastro.')
  }
  return findCatalogNeighborhoodByName(fallback)
}

export async function createReport(userId: string, input: CreateReport) {
  await assertModuleZeroCompleted(userId)
  await validateReportPhoto(userId, input.photoUrl)
  const resolved = await resolveReportNeighborhood(userId, input)
  const now = new Date()
  const report = await getPrisma().report.create({
    data: {
      userId,
      title: input.title.trim(),
      description: input.description.trim(),
      address: input.address.trim(),
      neighborhood: resolved.name,
      neighborhoodId: resolved.id,
      photoUrl: input.photoUrl ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      urgency: input.urgency ?? 'MEDIUM',
      status: 'SENT',
      pointsAwarded: 0,
      submittedAt: now,
      timeline: {
        create: [{ status: 'SENT', occurredAt: now }],
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      address: true,
      neighborhood: true,
      photoUrl: true,
      latitude: true,
      longitude: true,
      status: true,
      urgency: true,
      pointsAwarded: true,
      submittedAt: true,
      timeline: { orderBy: { occurredAt: 'asc' }, select: { status: true, occurredAt: true } },
    },
  })

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: await reportPhotoUrl(report.photoUrl),
    latitude: report.latitude,
    longitude: report.longitude,
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    pointsHint: pointsHint(report.pointsAwarded, report.status),
    submittedAt: report.submittedAt.toISOString(),
    timeline: buildTimeline(report.status, report.timeline),
  }
}

export async function listReports(userId: string) {
  const reports = await getPrisma().report.findMany({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      title: true,
      address: true,
      neighborhood: true,
      photoUrl: true,
      status: true,
      urgency: true,
      pointsAwarded: true,
      submittedAt: true,
    },
  })

  const sentCount = reports.length
  const resolvedCount = reports.filter((item) => item.status === 'RESOLVED').length
  const totalPoints = reports.reduce((sum, item) => sum + item.pointsAwarded, 0)

  return {
    summary: { sentCount, resolvedCount, totalPoints },
    reports: await Promise.all(reports.map(toListItem)),
  }
}

export async function getReport(userId: string, reportId: string) {
  const report = await getPrisma().report.findFirst({
    where: { id: reportId, userId },
    select: {
      id: true,
      title: true,
      description: true,
      address: true,
      neighborhood: true,
      photoUrl: true,
      latitude: true,
      longitude: true,
      status: true,
      urgency: true,
      pointsAwarded: true,
      submittedAt: true,
      timeline: { orderBy: { occurredAt: 'asc' }, select: { status: true, occurredAt: true } },
    },
  })
  if (!report) throw new ReportError('REPORT_NOT_FOUND', 'Relato não encontrado.')

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: await reportPhotoUrl(report.photoUrl),
    latitude: report.latitude,
    longitude: report.longitude,
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    pointsHint: pointsHint(report.pointsAwarded, report.status),
    submittedAt: report.submittedAt.toISOString(),
    timeline: buildTimeline(report.status, report.timeline),
  }
}

export async function getPendingImpact(userId: string) {
  const report = await getPrisma().report.findFirst({
    where: { userId, status: 'RESOLVED', impactSeenAt: null },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      title: true,
      neighborhood: true,
      pointsAwarded: true,
    },
  })
  if (!report) return null

  return {
    reportId: report.id,
    title: 'Seu relato ajudou o seu bairro',
    message: `Seu relato foi confirmado e pode ajudar a evitar um desligamento na ${report.neighborhood}.`,
    pointsAwarded: report.pointsAwarded,
    neighborhood: report.neighborhood,
  }
}

export async function markImpactSeen(userId: string, reportId: string) {
  const report = await getPrisma().report.findFirst({
    where: { id: reportId, userId, status: 'RESOLVED' },
    select: { id: true, impactSeenAt: true },
  })
  if (!report) throw new ReportError('IMPACT_NOT_AVAILABLE', 'Mensagem de impacto não disponível para este relato.')

  const impactSeenAt = report.impactSeenAt ?? new Date()
  if (!report.impactSeenAt) {
    await getPrisma().report.update({
      where: { id: reportId },
      data: { impactSeenAt },
    })
  }

  return { reportId, impactSeenAt: impactSeenAt.toISOString() }
}

function canTransition(from: ReportStatusCode, to: ReportStatusCode): boolean {
  if (from === to) return true
  if (from === 'RESOLVED' || from === 'NOT_CONFIRMED') return false
  if (to === 'NOT_CONFIRMED') return from === 'IN_ANALYSIS' || from === 'RECEIVED' || from === 'SENT'
  const fromIndex = TIMELINE_ORDER.indexOf(from)
  const toIndex = TIMELINE_ORDER.indexOf(to)
  return fromIndex >= 0 && toIndex > fromIndex
}

export async function updateAdminReportEmergency(reportId: string, requiresEmergencyTeam: boolean | null) {
  try {
    return await getPrisma().report.update({
      where: { id: reportId },
      data: { requiresEmergencyTeam },
      select: { id: true, requiresEmergencyTeam: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ReportError('REPORT_NOT_FOUND', 'Relato não encontrado.')
    }
    throw error
  }
}

export async function listAdminReports(status?: ReportStatusCode) {
  const reports = await getPrisma().report.findMany({
    ...(status ? { where: { status } } : {}),
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      address: true,
      neighborhood: true,
      photoUrl: true,
      requiresEmergencyTeam: true,
      latitude: true,
      longitude: true,
      status: true,
      urgency: true,
      pointsAwarded: true,
      impactSeenAt: true,
      submittedAt: true,
    },
  })

  return Promise.all(reports.map(async (report) => ({
    id: report.id,
    userId: report.userId,
    title: report.title,
    description: report.description,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: await reportPhotoUrl(report.photoUrl),
    requiresEmergencyTeam: report.requiresEmergencyTeam ?? null,
    latitude: report.latitude,
    longitude: report.longitude,
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    impactSeenAt: report.impactSeenAt?.toISOString() ?? null,
    submittedAt: report.submittedAt.toISOString(),
  })))
}

export async function updateAdminReportStatus(reportId: string, input: AdminReportStatusBody) {
  try {
    const updated = await getPrisma().$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          userId: true,
          title: true,
          description: true,
          address: true,
          neighborhood: true,
          photoUrl: true,
          requiresEmergencyTeam: true,
          latitude: true,
          longitude: true,
          status: true,
          urgency: true,
          pointsAwarded: true,
          impactSeenAt: true,
          submittedAt: true,
        },
      })
      if (!report) throw new ReportError('REPORT_NOT_FOUND', 'Relato não encontrado.')
      if (!canTransition(report.status, input.status)) {
        throw new ReportError('INVALID_STATUS_TRANSITION', 'Transição de status inválida para este relato.')
      }

      const now = new Date()
      const validating = input.status === 'RESOLVED' && report.status !== 'RESOLVED'
      if (validating && !input.confirmedRisk) throw new ReportError('INVALID_STATUS_TRANSITION', 'Informe o risco confirmado pela equipe.')
      if (input.confirmedRisk && !validating) throw new ReportError('INVALID_STATUS_TRANSITION', 'O risco só pode ser informado na primeira resolução.')
      let nextPoints = report.pointsAwarded
      if (validating) {
        const keys = ['report_' + input.confirmedRisk!.toLowerCase(), 'reports_daily', 'reports_monthly']
        const configurations = await tx.programConfiguration.findMany({ where: { key: { in: keys } } })
        const rule = configurations.find(row => row.key === keys[0] && row.kind === 'RULE')
        const limits = keys.slice(1).map(key => configurations.find(row => row.key === key && row.kind === 'LIMIT'))
        if (!rule || rule.value === null || limits.some(limit => !limit || (limit.isActive && limit.value === null))) {
          throw new ReportError('INVALID_STATUS_TRANSITION', 'Configure as regras e limites antes de validar.')
        }
        // Dia e mês da concessão em Fortaleza (UTC-3).
        const local = new Date(now.getTime() - 10800000)
        const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3))
        const month = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3))
        const tomorrow = new Date(day.getTime() + 86400000)
        const nextMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1, 3))
        let eligible = rule.isActive
        for (const [index, limit] of limits.entries()) {
          if (limit?.isActive) {
            const count = await tx.report.count({ where: { userId: report.userId, pointsAwarded: { gt: 0 }, validatedAt: { gte: index === 0 ? day : month, lt: index === 0 ? tomorrow : nextMonth } } })
            if (count >= limit.value!) eligible = false
          }
        }
        nextPoints = eligible ? rule.value : 0
      }
      if (input.status === 'NOT_CONFIRMED') nextPoints = 0
      if (report.status !== input.status) {
        await tx.reportTimelineEvent.create({
          data: { reportId, status: input.status, occurredAt: now },
        })
      }
      const updated = await tx.report.update({
        where: { id: reportId },
        data: {
          status: input.status,
          pointsAwarded: nextPoints,
          ...(validating ? { impactSeenAt: null, validatedAt: now, confirmedRisk: input.confirmedRisk } : {}),
        },
        select: {
          id: true,
          userId: true,
          title: true,
          description: true,
          address: true,
          neighborhood: true,
          photoUrl: true,
          requiresEmergencyTeam: true,
          latitude: true,
          longitude: true,
          status: true,
          urgency: true,
          pointsAwarded: true,
          impactSeenAt: true,
          submittedAt: true,
        },
      })
      if (validating && nextPoints > 0) {
        await creditPoints(
          {
            userId: report.userId,
            amount: nextPoints,
            reason: 'REPORT_CONFIRM',
            sourceType: 'Report',
            sourceId: report.id,
          },
          tx,
        )
      }
      return updated
    }, { isolationLevel: 'Serializable' })
    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      description: updated.description,
      address: updated.address,
      neighborhood: updated.neighborhood,
      photoUrl: await reportPhotoUrl(updated.photoUrl),
      requiresEmergencyTeam: updated.requiresEmergencyTeam ?? null,
      latitude: updated.latitude,
      longitude: updated.longitude,
      status: statusView(updated.status),
      urgency: urgencyView(updated.urgency),
      pointsAwarded: updated.pointsAwarded,
      impactSeenAt: updated.impactSeenAt?.toISOString() ?? null,
      submittedAt: updated.submittedAt.toISOString(),
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ReportError('REPORT_CONFLICT', 'Atualização concorrente. Consulte o relato e tente novamente.')
    throw error
  }
}
