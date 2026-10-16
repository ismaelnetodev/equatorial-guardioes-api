import { type Static, Type } from 'typebox'

export const trailParamsSchema = Type.Object({ trailId: Type.String({ format: 'uuid', description: 'Identificador único da trilha' }) }, { additionalProperties: false })
export type TrailParams = Static<typeof trailParamsSchema>

export const trailModuleSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  content: Type.String({ description: 'Conteúdo do módulo armazenado no banco de dados' }),
  order: Type.Integer({ minimum: 1, description: 'Posição do módulo dentro da trilha' }),
  durationMinutes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  isActive: Type.Boolean(),
}, { $id: 'TrailModule', title: 'Módulo de trilha', additionalProperties: false })
export type TrailModule = Static<typeof trailModuleSchema>

export const trailSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
}, { $id: 'Trail', title: 'Trilha', additionalProperties: false })
export type Trail = Static<typeof trailSchema>

export const trailDetailsSchema = Type.Intersect([
  trailSchema,
  Type.Object({ modules: Type.Array(trailModuleSchema, { description: 'Módulos ordenados dentro da trilha' }) }),
], { $id: 'TrailDetails', title: 'Detalhes da trilha', additionalProperties: false })
export type TrailDetails = Static<typeof trailDetailsSchema>

export const listTrailsResponseSchema = Type.Array(trailSchema, { $id: 'ListTrailsResponse' })
export const listTrailModulesResponseSchema = Type.Array(trailModuleSchema, { $id: 'ListTrailModulesResponse' })
export const trailNotFoundResponseSchema = Type.Object({ code: Type.Literal('TRAIL_NOT_FOUND'), message: Type.String() }, { additionalProperties: false })
