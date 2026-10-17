import { claimLearningAwards, LearningError } from '../quiz/learning-rules.service.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { ProgressError, completeModule, getTrailProgress, startModule } from './progress.service.js'
import type { ModuleProgressParams, TrailProgressParams } from './progress.schemas.js'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'

function sendProgressError(reply: FastifyReply, error: unknown) {
  if (error instanceof LearningError) return reply.status(409).send({ code: error.code, message: error.message })
  if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
  if (error instanceof ProgressError) {
    const statusCode = error.code === 'MODULE_NOT_FOUND' ? 404 : error.code === 'QUIZ_NOT_IMPLEMENTED' ? 501 : 409
    return reply.status(statusCode).send({ code: error.code, message: error.message })
  }
  throw error
}

export async function getTrailProgressController(request: FastifyRequest<{ Params: TrailProgressParams }>, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return await getTrailProgress(user.id, request.params.trailId)
  } catch (error) { return sendProgressError(reply, error) }
}

export async function startModuleController(request: FastifyRequest<{ Params: ModuleProgressParams }>, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return await startModule(user.id, request.params.moduleId)
  } catch (error) { return sendProgressError(reply, error) }
}

export async function completeModuleController(request: FastifyRequest<{ Params: ModuleProgressParams }>, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return await completeModule(user.id, request.params.moduleId)
  } catch (error) { return sendProgressError(reply, error) }
}

export async function claimLearningAwardsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    return await claimLearningAwards(user.id)
  } catch (error) { return sendProgressError(reply, error) }
}
