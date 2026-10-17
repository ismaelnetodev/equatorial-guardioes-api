import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import * as controller from './reports.controller.js'
import * as schema from './reports.schemas.js'

export const reportsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const common = { tags: ['Reports'], security: [{ bearerAuth: [] }] }
  const errors = {
    400: schema.errorResponseSchema,
    401: schema.errorResponseSchema,
    404: schema.errorResponseSchema,
    409: schema.errorResponseSchema,
  }

  app.post('/', {
    schema: {
      ...common,
      summary: 'Cria um relato após concluir o módulo 0',
      body: schema.createReportSchema,
      response: { 201: schema.reportDetailSchema, ...errors },
    },
  }, controller.createReportController)

  app.get('/', {
    schema: {
      ...common,
      summary: 'Lista os relatos do usuário com resumo',
      response: { 200: schema.reportsListResponseSchema, ...errors },
    },
  }, controller.listReportsController)

  app.get('/impacto', {
    schema: {
      ...common,
      summary: 'Consulta mensagem de impacto pendente',
      response: {
        200: schema.impactMessageSchema,
        ...errors,
      },
    },
  }, controller.getPendingImpactController)

  app.get('/:reportId', {
    schema: {
      ...common,
      summary: 'Consulta o detalhe e a linha do tempo de um relato',
      params: schema.reportParamsSchema,
      response: { 200: schema.reportDetailSchema, ...errors },
    },
  }, controller.getReportController)

  app.post('/:reportId/impacto/visto', {
    schema: {
      ...common,
      summary: 'Marca a mensagem de impacto do relato como vista',
      params: schema.reportParamsSchema,
      response: { 200: schema.impactSeenResponseSchema, ...errors },
    },
  }, controller.markImpactSeenController)
}
