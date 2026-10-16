import process from 'node:process'
import Fastify, { type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { authRoutes } from './modules/auth/auth.routes.js'
import { trailsRoutes } from './modules/trails/trails.routes.js'

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({ logger: true, ...options }).withTypeProvider<TypeBoxTypeProvider>()

  const corsOrigins = process.env['CORS_ORIGINS']?.split(',').map((origin) => origin.trim()).filter((origin) => origin.length > 0)

  // CSP desabilitada porque a página do Swagger UI depende de scripts inline.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Guardiões API',
        description: 'API da plataforma Guardiões.',
        version: '1.0.0',
      },
      tags: [
        { name: 'Auth', description: 'Cadastro e autenticação de usuários' },
        { name: 'Trails', description: 'Trilhas e módulos de capacitação' },
      ],
    },
  })
  await app.register(swaggerUi, { routePrefix: '/documentation' })

  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(trailsRoutes, { prefix: '/api/v1/trails' })

  return app
}
