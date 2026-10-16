import type { FastifyReply, FastifyRequest } from 'fastify'
import { TrailNotFoundError, getTrail, listTrailModules, listTrails } from './trails.service.js'
import type { TrailParams } from './trails.schemas.js'

function sendTrailNotFound(reply: FastifyReply) {
  return reply.status(404).send({ code: 'TRAIL_NOT_FOUND', message: 'Trilha não encontrada.' })
}

export async function listTrailsController() { return listTrails() }

export async function getTrailController(request: FastifyRequest<{ Params: TrailParams }>, reply: FastifyReply) {
  try { return await getTrail(request.params.trailId) } catch (error) {
    if (error instanceof TrailNotFoundError) return sendTrailNotFound(reply)
    throw error
  }
}

export async function listTrailModulesController(request: FastifyRequest<{ Params: TrailParams }>, reply: FastifyReply) {
  try { return await listTrailModules(request.params.trailId) } catch (error) {
    if (error instanceof TrailNotFoundError) return sendTrailNotFound(reply)
    throw error
  }
}
