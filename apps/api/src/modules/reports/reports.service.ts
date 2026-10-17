import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { creditPoints } from '../../lib/points-ledger.js'
import { getPrisma } from '../../lib/prisma.js'
import type {
  AdminReportStatusBody,
  CreateReport,
  ReportStatusCode,
  ReportUrgencyCode,
} from './reports.schemas.js'

const SEND_POINTS = 10
const CONFIRM_POINTS = 40

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
      | 'INVALID_STATUS_TRANSITION',
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
  if (status === 'RESOLVED' || pointsAwarded >= SEND_POINTS + CONFIRM_POINTS) {
    return `+${SEND_POINTS} pts por enviar · +${CONFIRM_POINTS} confirmados`
  }
  return `+${SEND_POINTS} pts por enviar · +${CONFIRM_POINTS} se confirmado`
}

async function assertModuleZeroCompleted(userId: string): Promise<void> {
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
  const firstModule = trail?.modules[0]
  if (!firstModule?.progressRecords[0]?.completedAt) {
    throw new ReportError('REPORTS_LOCKED', 'Conclua o módulo 0 para liberar os relatos.')
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

function toListItem(report: {
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
    photoUrl: report.photoUrl,
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    submittedAt: report.submittedAt.toISOString(),
  }
}

export async function createReport(userId: string, input: CreateReport) {
  await assertModuleZeroCompleted(userId)
  const now = new Date()
  const report = await getPrisma().$transaction(async (tx) => {
    const created = await tx.report.create({
      data: {
        userId,
        title: input.title.trim(),
        description: input.description.trim(),
        address: input.address.trim(),
        neighborhood: input.neighborhood.trim(),
        photoUrl: input.photoUrl ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        urgency: input.urgency ?? 'MEDIUM',
        status: 'SENT',
        pointsAwarded: SEND_POINTS,
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
    await creditPoints(
      {
        userId,
        amount: SEND_POINTS,
        reason: 'REPORT_SEND',
        sourceType: 'ReportSend',
        sourceId: created.id,
      },
      tx,
    )
    return created
  })

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: report.photoUrl,
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
    reports: reports.map(toListItem),
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
    photoUrl: report.photoUrl,
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
    pointsAwarded: Math.max(CONFIRM_POINTS, report.pointsAwarded - SEND_POINTS),
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
      status: true,
      urgency: true,
      pointsAwarded: true,
      impactSeenAt: true,
      submittedAt: true,
    },
  })

  return reports.map((report) => ({
    id: report.id,
    userId: report.userId,
    title: report.title,
    description: report.description,
    address: report.address,
    neighborhood: report.neighborhood,
    photoUrl: report.photoUrl,
    status: statusView(report.status),
    urgency: urgencyView(report.urgency),
    pointsAwarded: report.pointsAwarded,
    impactSeenAt: report.impactSeenAt?.toISOString() ?? null,
    submittedAt: report.submittedAt.toISOString(),
  }))
}

export async function updateAdminReportStatus(reportId: string, input: AdminReportStatusBody) {
  const report = await getPrisma().report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      address: true,
      neighborhood: true,
      photoUrl: true,
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
  const addingConfirmPoints = input.status === 'RESOLVED' && report.status !== 'RESOLVED'
  const nextPoints = addingConfirmPoints ? report.pointsAwarded + CONFIRM_POINTS : report.pointsAwarded

  const updated = await getPrisma().$transaction(async (tx) => {
    if (report.status !== input.status) {
      await tx.reportTimelineEvent.create({
        data: { reportId, status: input.status, occurredAt: now },
      })
    }
    const next = await tx.report.update({
      where: { id: reportId },
      data: {
        status: input.status,
        pointsAwarded: nextPoints,
        ...(addingConfirmPoints ? { impactSeenAt: null } : {}),
      },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        address: true,
        neighborhood: true,
        photoUrl: true,
        status: true,
        urgency: true,
        pointsAwarded: true,
        impactSeenAt: true,
        submittedAt: true,
      },
    })
    if (addingConfirmPoints) {
      await creditPoints(
        {
          userId: report.userId,
          amount: CONFIRM_POINTS,
          reason: 'REPORT_CONFIRM',
          sourceType: 'ReportConfirm',
          sourceId: reportId,
        },
        tx,
      )
    }
    return next
  })

  return {
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    description: updated.description,
    address: updated.address,
    neighborhood: updated.neighborhood,
    photoUrl: updated.photoUrl,
    status: statusView(updated.status),
    urgency: urgencyView(updated.urgency),
    pointsAwarded: updated.pointsAwarded,
    impactSeenAt: updated.impactSeenAt?.toISOString() ?? null,
    submittedAt: updated.submittedAt.toISOString(),
  }
}
