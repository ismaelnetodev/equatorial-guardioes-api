import type { FastifyReply, FastifyRequest } from 'fastify'
import { ProgressError, completeModule, getTrailProgress, startModule, submitQuiz } from './progress.service.js'
import type { ModuleProgressParams, SubmitQuiz, TrailProgressParams } from './progress.schemas.js'
import { getSessionUserId } from '../../lib/auth-session.js'

function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = getSessionUserId(request.headers.authorization)
  if (!userId) {
    throw new ProgressError('UNAUTHENTICATED', 'Usuário não autenticado.')
  }
  return userId
}

function sendProgressError(reply: FastifyReply, error: ProgressError) {
  const statusCode = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'MODULE_NOT_FOUND' ? 404 : error.code === 'INVALID_QUIZ_CONFIGURATION' || error.code === 'INVALID_QUIZ_ANSWERS' ? 422 : 409
  return reply.status(statusCode).send({ code: error.code, message: error.message })
}

export async function getTrailProgressController(request: FastifyRequest<{ Params: TrailProgressParams }>, reply: FastifyReply) {
  try { return await getTrailProgress(getAuthenticatedUserId(request), request.params.trailId) } catch (error) {
    if (error instanceof ProgressError) return sendProgressError(reply, error)
    throw error
  }
}

export async function startModuleController(request: FastifyRequest<{ Params: ModuleProgressParams }>, reply: FastifyReply) {
  try { return await startModule(getAuthenticatedUserId(request), request.params.moduleId) } catch (error) {
    if (error instanceof ProgressError) return sendProgressError(reply, error)
    throw error
  }
}

export async function submitQuizController(request: FastifyRequest<{ Params: ModuleProgressParams; Body: SubmitQuiz }>, reply: FastifyReply) {
  try { return await submitQuiz(getAuthenticatedUserId(request), request.params.moduleId, request.body) } catch (error) {
    if (error instanceof ProgressError) return sendProgressError(reply, error)
    throw error
  }
}

export async function completeModuleController(request: FastifyRequest<{ Params: ModuleProgressParams }>, reply: FastifyReply) {
  try { return await completeModule(getAuthenticatedUserId(request), request.params.moduleId) } catch (error) {
    if (error instanceof ProgressError) return sendProgressError(reply, error)
    throw error
  }
}
