import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { errorResponseSchema } from '../auth/auth.schemas.js'
import { getTrailController, listTrailModulesController, listTrailsController } from './trails.controller.js'
import { listTrailModulesResponseSchema, listTrailsResponseSchema, trailDetailsSchema, trailNotFoundResponseSchema, trailParamsSchema } from './trails.schemas.js'

export const trailsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/', { schema: { tags: ['Trails'], summary: 'Lista as trilhas disponíveis', response: { 200: listTrailsResponseSchema } } }, listTrailsController)
  app.get('/:trailId', { schema: { tags: ['Trails'], summary: 'Consulta uma trilha com seus módulos', params: trailParamsSchema, security: [{}, { bearerAuth: [] }], response: { 200: trailDetailsSchema, 401: errorResponseSchema, 404: trailNotFoundResponseSchema } } }, getTrailController)
  app.get('/:trailId/modules', { schema: { tags: ['Trails'], summary: 'Lista os módulos de uma trilha', params: trailParamsSchema, security: [{}, { bearerAuth: [] }], response: { 200: listTrailModulesResponseSchema, 401: errorResponseSchema, 404: trailNotFoundResponseSchema } } }, listTrailModulesController)
}
