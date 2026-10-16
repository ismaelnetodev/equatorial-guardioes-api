import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'
import type { CreateReport, ReportParams } from './reports.schemas.js'
import {
  ReportError,
  createReport,
  getPendingImpact,
  getReport,
  listReports,
  markImpactSeen,
} from './reports.service.js'

function statusFor(code: ReportError['code']): number {
  if (code === 'REPORT_NOT_FOUND' || code === 'IMPACT_NOT_AVAILABLE') return 404
  if (code === 'REPORTS_LOCKED') return 409
  return 409
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthenticationError) {
    return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
  }
  if (error instanceof ReportError) {
    return reply.status(statusFor(error.code)).send({ code: error.code, message: error.message })
  }
  throw error
}

async function withAuth<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: (userId: string) => Promise<T>,
  status = 200,
) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    const result = await operation(user.id)
    if (result === null) {
      // Sem schema de corpo no 204: o OpenAPI documenta o 200 quando há impacto.
      return reply.status(204).send()
    }
    return reply.status(status).send(result)
  } catch (error) {
    return sendError(reply, error)
  }
}

export async function createReportController(request: FastifyRequest<{ Body: CreateReport }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => createReport(userId, request.body), 201)
}

export async function listReportsController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => listReports(userId))
}

export async function getReportController(request: FastifyRequest<{ Params: ReportParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getReport(userId, request.params.reportId))
}

export async function getPendingImpactController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getPendingImpact(userId))
}

export async function markImpactSeenController(request: FastifyRequest<{ Params: ReportParams }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => markImpactSeen(userId, request.params.reportId))
}
