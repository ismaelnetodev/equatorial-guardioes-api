import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError } from '../../lib/auth-user.js'
import * as service from './admin.service.js'
import type { AdminTrailParams, AdminModuleParams, CreateTrail, UpdateTrail, CreateModule, UpdateModule, ChangeStatus, Reorder, ChangePassword } from './admin.schemas.js'
import type { AdminTrailParams, AdminModuleParams, CreateTrail, UpdateTrail, CreateModule, UpdateModule, ChangeStatus, Reorder, ReplaceQuiz, ReplaceTraining, AdminReportStatusBody, AdminReportsQuery, ReportParams } from './admin.schemas.js'
import { ReportError, listAdminReports, updateAdminReportStatus } from '../reports/reports.service.js'

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
  if (error instanceof ReportError) {
    const status = error.code === 'REPORT_NOT_FOUND' ? 404 : 422
    return reply.status(status).send({ code: error.code, message: error.message })
  }
  if (error instanceof service.AdminError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'TRAIL_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND' ? 404 : error.code === 'CONTENT_CONFLICT' ? 409 : 422
    return reply.status(status).send({ code: error.code, message: error.message })
  }
  throw error
}

async function respond<T>(reply: FastifyReply, operation: () => Promise<T>, status = 200) {
  try { return reply.status(status).send(await operation()) } catch (error) { return sendError(reply, error) }
}

export async function authorizeAdminRequest(request: FastifyRequest, reply: FastifyReply) {
  try { await service.authorizeAdministrator(request.headers.authorization) } catch (error) { return sendError(reply, error) }
}

export async function changePasswordController(request: FastifyRequest<{ Body: ChangePassword }>, reply: FastifyReply) {
  return respond(reply, () => service.changeAdministratorPassword(request.headers.authorization, request.body.currentPassword, request.body.newPassword))
}

export async function listTrailsController(_request: FastifyRequest, reply: FastifyReply) {
  return respond(reply, () => service.listAdminTrails())
}
export async function getTrailController(request: FastifyRequest<{ Params: AdminTrailParams }>, reply: FastifyReply) {
  return respond(reply, () => service.getAdminTrail(request.params.trailId))
}
export async function createTrailController(request: FastifyRequest<{ Body: CreateTrail }>, reply: FastifyReply) {
  return respond(reply, () => service.createTrail(request.body), 201)
}
export async function updateTrailController(request: FastifyRequest<{ Params: AdminTrailParams; Body: UpdateTrail }>, reply: FastifyReply) {
  return respond(reply, () => service.updateTrail(request.params.trailId, request.body))
}
export async function changeTrailStatusController(request: FastifyRequest<{ Params: AdminTrailParams; Body: ChangeStatus }>, reply: FastifyReply) {
  return respond(reply, () => service.changeTrailStatus(request.params.trailId, request.body.status))
}
export async function reorderTrailsController(request: FastifyRequest<{ Body: Reorder }>, reply: FastifyReply) {
  return respond(reply, () => service.reorderTrails(request.body.ids))
}
export async function createModuleController(request: FastifyRequest<{ Params: AdminTrailParams; Body: CreateModule }>, reply: FastifyReply) {
  return respond(reply, () => service.createModule(request.params.trailId, request.body), 201)
}
export async function updateModuleController(request: FastifyRequest<{ Params: AdminModuleParams; Body: UpdateModule }>, reply: FastifyReply) {
  return respond(reply, () => service.updateModule(request.params.trailId, request.params.moduleId, request.body))
}
export async function changeModuleStatusController(request: FastifyRequest<{ Params: AdminModuleParams; Body: ChangeStatus }>, reply: FastifyReply) {
  return respond(reply, () => service.changeModuleStatus(request.params.trailId, request.params.moduleId, request.body.status))
}
export async function reorderModulesController(request: FastifyRequest<{ Params: AdminTrailParams; Body: Reorder }>, reply: FastifyReply) {
  return respond(reply, () => service.reorderModules(request.params.trailId, request.body.ids))
}

export async function getModuleQuizController(request: FastifyRequest<{ Params: AdminModuleParams }>, reply: FastifyReply) {
  return respond(reply, () => service.getModuleQuiz(request.params.trailId, request.params.moduleId))
}

export async function replaceModuleQuizController(request: FastifyRequest<{ Params: AdminModuleParams; Body: ReplaceQuiz }>, reply: FastifyReply) {
  return respond(reply, () => service.replaceModuleQuiz(request.params.trailId, request.params.moduleId, request.body))
}

export async function getModuleTrainingController(request: FastifyRequest<{ Params: AdminModuleParams }>, reply: FastifyReply) {
  return respond(reply, () => service.getModuleTraining(request.params.trailId, request.params.moduleId))
}

export async function replaceModuleTrainingController(request: FastifyRequest<{ Params: AdminModuleParams; Body: ReplaceTraining }>, reply: FastifyReply) {
  return respond(reply, () => service.replaceModuleTraining(request.params.trailId, request.params.moduleId, request.body))
}

export async function listReportsController(request: FastifyRequest<{ Querystring: AdminReportsQuery }>, reply: FastifyReply) {
  return respond(reply, () => listAdminReports(request.query.status))
}

export async function updateReportStatusController(request: FastifyRequest<{ Params: ReportParams; Body: AdminReportStatusBody }>, reply: FastifyReply) {
  return respond(reply, () => updateAdminReportStatus(request.params.reportId, request.body))
}
