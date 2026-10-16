import Fastify, { type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { rewardsAdminRoutes } from './modules/rewards-admin/rewards-admin.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { trailsRoutes } from './modules/trails/trails.routes.js'
import { progressRoutes } from './modules/progress/progress.routes.js'
import { quizRoutes } from './modules/quiz/quiz.routes.js'
import { reportsRoutes } from './modules/reports/reports.routes.js'
import { buildCorsOptions } from './lib/cors.js'
import { neighborhoodsRoutes } from './modules/neighborhoods/neighborhoods.routes.js'

export async function buildApp(options: FastifyServerOptions = {}) {
  const corsOptions = buildCorsOptions()
  const app = Fastify({ logger: true, ...options }).withTypeProvider<TypeBoxTypeProvider>()

  // CSP desabilitada porque a página do Swagger UI depende de scripts inline.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, corsOptions)
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Aguarde antes de tentar novamente.' }),
  })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Guardiões da Energia API',
        description: 'API da plataforma Guardiões da Energia.',
        version: '1.0.0',
      },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'Token recebido no login' } } },
      tags: [
        { name: 'Admin', description: 'Administração de trilhas e módulos' },
        { name: 'Auth', description: 'Cadastro e autenticação de usuários' },
        { name: 'Neighborhoods', description: 'Catálogo de bairros e sua fonte' },
        { name: 'Trails', description: 'Trilhas e módulos de capacitação' },
        { name: 'Progress', description: 'Progresso e desbloqueio de módulos' },
        { name: 'Quiz', description: 'Pré-teste, treinamento e pós-teste dos módulos' },
        { name: 'Reports', description: 'Relatos do Guardião e acompanhamento de status' },
      ],
    },
  })
  await app.register(swaggerUi, { routePrefix: '/documentation' })

  await app.register(adminRoutes, { prefix: '/api/v1/admin' })
  await app.register(rewardsAdminRoutes, { prefix: '/api/v1/admin/points-rewards' })
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(neighborhoodsRoutes, { prefix: '/api/v1/neighborhoods' })
  await app.register(trailsRoutes, { prefix: '/api/v1/trails' })
  await app.register(progressRoutes, { prefix: '/api/v1/progress' })
  await app.register(quizRoutes, { prefix: '/api/v1/modules' })
  await app.register(reportsRoutes, { prefix: '/api/v1/relatos' })

  return app
}
