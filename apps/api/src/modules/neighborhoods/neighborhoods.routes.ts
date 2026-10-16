import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { neighborhoodQuerySchema, neighborhoodsResponseSchema } from './neighborhoods.schemas.js'
import { listNeighborhoods } from './neighborhoods.service.js'

export const neighborhoodsRoutes: FastifyPluginAsyncTypebox = async app => {
  app.get('/', { schema: {
    tags: ['Neighborhoods'], summary: 'Lista bairros por município (padrão: São Luís/MA)',
    querystring: neighborhoodQuerySchema, response: { 200: neighborhoodsResponseSchema },
  } }, async request => ({ neighborhoods: await listNeighborhoods(request.query.municipalityCode) }))
}
