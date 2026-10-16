import { TypeBoxValidatorCompiler, type FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import * as controller from './rewards-admin.controller.js'
import * as schema from './rewards-admin.schemas.js'

export const rewardsAdminRoutes: FastifyPluginAsyncTypebox = async app => {
  app.decorateRequest('configurationAdminId', null)
  app.addHook('onRequest', controller.authorize)
  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error && error.validation) return reply.status(400).send({ code: 'VALIDATION_ERROR', message: 'Dados inválidos. Verifique os parâmetros e campos enviados.' })
    return reply.send(error)
  })
  const common = { tags: ['Admin'], security: [{ bearerAuth: [] }] }
  const errors = { 400: schema.errorSchema, 401: schema.errorSchema, 403: schema.errorSchema, 404: schema.errorSchema, 409: schema.errorSchema, 422: schema.errorSchema }
  for (const [path, kind] of [['rules', 'RULE'], ['rewards', 'REWARD'], ['limits', 'LIMIT']] as const) {
    app.get('/' + path, { schema: { ...common, summary: `Lista configurações: ${path}`, response: { 200: schema.configurationsSchema, ...errors } } }, controller.list(kind))
    // Preserva o JSON recebido: null não pode virar 0/false e campos extras são rejeitados.
    app.patch('/' + path + '/:key', { validatorCompiler: TypeBoxValidatorCompiler, schema: { ...common, summary: `Altera valor ou ativação: ${path}`, params: schema.paramsSchema, body: schema.updateSchema, response: { 200: schema.configurationSchema, ...errors } } }, controller.update(kind))
  }
  app.get('/history', { schema: { ...common, summary: 'Histórico de alterações de pontos, recompensas e limites', querystring: schema.historyQuerySchema, response: { 200: schema.historySchema, ...errors } } }, controller.history)
}
