import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import multipart from '@fastify/multipart'
import { MAX_PHOTO_BYTES } from './report-photo.service.js'
import * as controller from './reports.controller.js'
import * as schema from './reports.schemas.js'

export const reportsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  await app.register(multipart, { attachFieldsToBody: true, limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0, parts: 1 } })
  const common = { tags: ['Reports'], security: [{ bearerAuth: [] }] }
  const errors = {
    400: schema.errorResponseSchema,
    401: schema.errorResponseSchema,
    404: schema.errorResponseSchema,
    409: schema.errorResponseSchema,
  }

  app.post('/foto', {
    onRequest: controller.authorizeReportPhotoUpload,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      ...common, summary: 'Envia uma foto privada para anexar a um relato', consumes: ['multipart/form-data'],
      body: structuredClone(schema.uploadReportPhotoSchema),
      response: { 201: schema.uploadReportPhotoResponseSchema, ...errors, 413: schema.errorResponseSchema, 415: schema.errorResponseSchema, 422: schema.errorResponseSchema, 429: schema.errorResponseSchema, 503: schema.errorResponseSchema },
    },
  }, controller.uploadReportPhotoController)

  app.post('/', {
    schema: {
      ...common,
      summary: 'Cria um relato após concluir o módulo 0',
      body: schema.createReportSchema,
      response: { 201: schema.reportDetailSchema, ...errors, 422: schema.errorResponseSchema, 503: schema.errorResponseSchema },
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
        200: schema.pendingImpactResponseSchema,
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
