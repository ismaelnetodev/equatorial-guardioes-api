import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'
import type { CreateReport, ReportParams, UploadReportPhoto } from './reports.schemas.js'
import { ReportPhotoError, uploadReportPhoto } from './report-photo.service.js'
import {
  ReportError,
  assertModuleZeroCompleted,
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
  if (error instanceof ReportPhotoError) return reply.status(error.code === 'INVALID_PHOTO' ? 422 : 503).send({ code: error.code, message: error.message })
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
    return reply.status(status).send(result)
  } catch (error) {
    return sendError(reply, error)
  }
}

export async function createReportController(request: FastifyRequest<{ Body: CreateReport }>, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => createReport(userId, request.body), 201)
}

export async function authorizeReportPhotoUpload(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    if (!/^multipart\/form-data(?:;|$)/i.test(request.headers['content-type'] ?? '')) return reply.status(415).send({ code: 'INVALID_PHOTO', message: 'Envie a foto como multipart/form-data.' })
    await assertModuleZeroCompleted(user.id)
  } catch (error) { return sendError(reply, error) }
}

export async function uploadReportPhotoController(request: FastifyRequest<{ Body: UploadReportPhoto }>, reply: FastifyReply) {
  return withAuth(request, reply, async userId => {
    const photo = request.body.foto
    return uploadReportPhoto(userId, await photo.toBuffer(), photo.mimetype)
  }, 201)
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
