import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import * as controller from './community.controller.js'
import * as schema from './community.schemas.js'

export const communityRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const common = { tags: ['Community'], security: [{ bearerAuth: [] }] }
  const errors = {
    400: schema.errorResponseSchema,
    401: schema.errorResponseSchema,
    404: schema.errorResponseSchema,
    409: schema.errorResponseSchema,
    422: schema.errorResponseSchema,
  }

  app.get('/ranking', {
    schema: {
      ...common,
      summary: 'Ranking de Guardiões por bairro (pontos acumulados)',
      response: { 200: schema.rankingResponseSchema, ...errors },
    },
  }, controller.getRankingController)

  app.get('/recompensas', {
    schema: {
      ...common,
      summary: 'Saldo, nível e catálogo de recompensas ativas',
      response: { 200: schema.rewardsResponseSchema, ...errors },
    },
  }, controller.getRewardsController)

  app.post('/recompensas/:key/resgatar', {
    schema: {
      ...common,
      summary: 'Resgata uma recompensa debitando apenas o saldo',
      params: schema.rewardKeyParamsSchema,
      response: { 201: schema.redeemResponseSchema, ...errors },
    },
  }, controller.redeemRewardController)

  app.get('/convidar', {
    schema: {
      ...common,
      summary: 'Código de convite e estatísticas do convidante',
      response: { 200: schema.inviteResponseSchema, ...errors },
    },
  }, controller.getInviteController)

  app.post('/convidar/atribuir', {
    schema: {
      ...common,
      summary: 'Atribui um código de convite ao usuário autenticado',
      body: schema.assignInviteBodySchema,
      response: { 201: schema.assignInviteResponseSchema, ...errors },
    },
  }, controller.assignInviteController)

  app.get('/perfil', {
    schema: {
      ...common,
      summary: 'Perfil do Guardião: nível, pontos, selos e atalhos',
      response: { 200: schema.profileResponseSchema, ...errors },
    },
  }, controller.getProfileController)

  app.patch('/perfil', {
    schema: {
      ...common,
      summary: 'Atualiza nome e bairro do Guardião',
      body: schema.updateProfileBodySchema,
      response: { 200: schema.profileResponseSchema, ...errors },
    },
  }, controller.updateProfileController)
}
