import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import * as controller from './admin.controller.js'
import * as schema from './admin.schemas.js'

export const adminRoutes: FastifyPluginAsyncTypebox = async app => {
  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error && error.validation) return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'Dados inválidos. Verifique os parâmetros e campos enviados.' })
    return reply.send(error)
  })
  app.addHook('onRequest', controller.authorizeAdminRequest)
  const common = { tags: ['Admin'], security: [{ bearerAuth: [] }] }
  const errors = { 400: schema.adminErrorSchema, 401: schema.adminErrorSchema, 403: schema.adminErrorSchema, 404: schema.adminErrorSchema, 409: schema.adminErrorSchema, 422: schema.adminErrorSchema }
  app.patch('/password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { ...common, summary: 'Altera a senha do próprio administrador', body: schema.changePasswordSchema, response: { 200: schema.passwordChangedSchema, ...errors, 429: schema.adminErrorSchema } } }, controller.changePasswordController)
  app.get('/trails', { schema: { ...common, summary: 'Lista todas as trilhas para administração', response: { 200: schema.adminTrailsSchema, ...errors } } }, controller.listTrailsController)
  app.get('/trails/:trailId', { schema: { ...common, summary: 'Consulta uma trilha e todos os seus módulos', params: schema.adminTrailParamsSchema, response: { 200: schema.adminTrailDetailsSchema, ...errors } } }, controller.getTrailController)
  app.post('/trails', { schema: { ...common, summary: 'Cadastra uma trilha em rascunho', body: schema.createTrailSchema, response: { 201: schema.adminTrailSchema, ...errors } } }, controller.createTrailController)
  app.patch('/trails/:trailId', { schema: { ...common, summary: 'Edita os dados de uma trilha', params: schema.adminTrailParamsSchema, body: schema.updateTrailSchema, response: { 200: schema.adminTrailSchema, ...errors } } }, controller.updateTrailController)
  app.patch('/trails/:trailId/status', { schema: { ...common, summary: 'Publica, arquiva, desativa ou retorna uma trilha a rascunho', params: schema.adminTrailParamsSchema, body: schema.changeStatusSchema, response: { 200: schema.adminTrailSchema, ...errors } } }, controller.changeTrailStatusController)
  app.put('/trails/order', { schema: { ...common, summary: 'Define a ordem de todas as trilhas', body: schema.reorderSchema, response: { 200: schema.adminTrailsSchema, ...errors } } }, controller.reorderTrailsController)
  app.post('/trails/:trailId/modules', { schema: { ...common, summary: 'Cadastra um módulo em rascunho', params: schema.adminTrailParamsSchema, body: schema.createModuleSchema, response: { 201: schema.adminModuleSchema, ...errors } } }, controller.createModuleController)
  app.patch('/trails/:trailId/modules/:moduleId', { schema: { ...common, summary: 'Edita os dados de um módulo', params: schema.adminModuleParamsSchema, body: schema.updateModuleSchema, response: { 200: schema.adminModuleSchema, ...errors } } }, controller.updateModuleController)
  app.patch('/trails/:trailId/modules/:moduleId/status', { schema: { ...common, summary: 'Publica, arquiva, desativa ou retorna um módulo a rascunho', params: schema.adminModuleParamsSchema, body: schema.changeStatusSchema, response: { 200: schema.adminModuleSchema, ...errors } } }, controller.changeModuleStatusController)
  app.put('/trails/:trailId/modules/order', { schema: { ...common, summary: 'Define a ordem de todos os módulos da trilha', params: schema.adminTrailParamsSchema, body: schema.reorderSchema, response: { 200: schema.adminModulesSchema, ...errors } } }, controller.reorderModulesController)
  app.get('/trails/:trailId/modules/:moduleId/quiz', { schema: { ...common, summary: 'Lista perguntas e alternativas do quiz do módulo', params: schema.adminModuleParamsSchema, response: { 200: schema.adminQuizSchema, ...errors } } }, controller.getModuleQuizController)
  app.put('/trails/:trailId/modules/:moduleId/quiz', { schema: { ...common, summary: 'Substitui todas as perguntas do quiz do módulo', params: schema.adminModuleParamsSchema, body: schema.replaceQuizSchema, response: { 200: schema.adminQuizSchema, ...errors } } }, controller.replaceModuleQuizController)
  app.get('/trails/:trailId/modules/:moduleId/training', { schema: { ...common, summary: 'Lista as etapas de treinamento do módulo', params: schema.adminModuleParamsSchema, response: { 200: schema.adminTrainingSchema, ...errors } } }, controller.getModuleTrainingController)
  app.put('/trails/:trailId/modules/:moduleId/training', { schema: { ...common, summary: 'Substitui todas as etapas de treinamento do módulo', params: schema.adminModuleParamsSchema, body: schema.replaceTrainingSchema, response: { 200: schema.adminTrainingSchema, ...errors } } }, controller.replaceModuleTrainingController)
  app.get('/relatos', { schema: { ...common, summary: 'Lista relatos para administração', querystring: schema.adminReportsQuerySchema, response: { 200: schema.adminReportsListSchema, ...errors } } }, controller.listReportsController)
  app.patch('/relatos/:reportId/status', { schema: { ...common, summary: 'Atualiza o status de um relato e a linha do tempo', params: schema.reportParamsSchema, body: schema.adminReportStatusBodySchema, response: { 200: schema.adminReportItemSchema, ...errors } } }, controller.updateReportStatusController)
}
