import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ProgramConfigurationKind } from '../../generated/prisma/client.js'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'
import { AdminError } from '../admin/admin.service.js'
import * as service from './rewards-admin.service.js'
import type { ConfigurationParams, HistoryQuery, UpdateConfiguration } from './rewards-admin.schemas.js'

declare module 'fastify' {
  interface FastifyRequest { configurationAdminId: string | null }
}

async function respond(reply: FastifyReply, operation: () => Promise<unknown>) {
  try { return reply.send(await operation()) } catch (error) {
    if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
    if (error instanceof AdminError) return reply.status(403).send({ code: error.code, message: error.message })
    if (error instanceof service.ConfigurationError) return reply.status(error.code === 'CONFIGURATION_NOT_FOUND' ? 404 : error.code === 'CONFIGURATION_CONFLICT' ? 409 : 422).send({ code: error.code, message: error.message })
    throw error
  }
}

export async function authorize(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    if (user.role !== 'ADMIN') throw new AdminError('FORBIDDEN', 'Acesso permitido apenas a administradores.')
    request.configurationAdminId = user.id
  } catch (error) { return respond(reply, async () => { throw error }) }
}

export const list = (kind: ProgramConfigurationKind) => async (_request: FastifyRequest, reply: FastifyReply) => respond(reply, () => service.listConfigurations(kind))
export const update = (kind: ProgramConfigurationKind) => async (request: FastifyRequest<{ Params: ConfigurationParams; Body: UpdateConfiguration }>, reply: FastifyReply) => respond(reply, () => {
  if (!request.configurationAdminId) throw new AuthenticationError()
  return service.updateConfiguration(kind, request.params.key, request.body, request.configurationAdminId)
})
export async function history(request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply) {
  return respond(reply, () => service.listConfigurationHistory(request.query))
}
