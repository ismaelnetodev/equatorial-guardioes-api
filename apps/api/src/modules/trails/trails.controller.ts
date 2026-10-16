import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError } from '../../lib/auth-user.js'
import { TrailNotFoundError, getTrail, listTrailModules, listTrails } from './trails.service.js'
import type { TrailParams } from './trails.schemas.js'

function sendTrailNotFound(reply: FastifyReply) {
  return reply.status(404).send({ code: 'TRAIL_NOT_FOUND', message: 'Trilha não encontrada.' })
}

export async function listTrailsController() { return listTrails() }

export async function getTrailController(request: FastifyRequest<{ Params: TrailParams }>, reply: FastifyReply) {
  try { return await getTrail(request.params.trailId, request.headers.authorization) } catch (error) {
    if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
    if (error instanceof TrailNotFoundError) return sendTrailNotFound(reply)
    throw error
  }
}

export async function listTrailModulesController(request: FastifyRequest<{ Params: TrailParams }>, reply: FastifyReply) {
  try { return await listTrailModules(request.params.trailId, request.headers.authorization) } catch (error) {
    if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
    if (error instanceof TrailNotFoundError) return sendTrailNotFound(reply)
    throw error
  }
}
