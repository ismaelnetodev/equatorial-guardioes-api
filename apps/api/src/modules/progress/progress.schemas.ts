import { type Static, Type } from 'typebox'

export const trailProgressParamsSchema = Type.Object({ trailId: Type.String({ format: 'uuid' }) }, { additionalProperties: false })
export type TrailProgressParams = Static<typeof trailProgressParamsSchema>

export const moduleProgressParamsSchema = Type.Object({ moduleId: Type.String({ format: 'uuid' }) }, { additionalProperties: false })
export type ModuleProgressParams = Static<typeof moduleProgressParamsSchema>

export const moduleStatusSchema = Type.Union([Type.Literal('blocked'), Type.Literal('available'), Type.Literal('in_progress'), Type.Literal('completed')])
export const moduleProgressSchema = Type.Object({
  moduleId: Type.String({ format: 'uuid' }), title: Type.String(), order: Type.Integer({ minimum: 1 }), status: moduleStatusSchema,
  readingSeconds: Type.Integer({ minimum: 0 }),
  requiresQuiz: Type.Boolean(), startedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
}, { additionalProperties: false })
export const trailProgressResponseSchema = Type.Object({ trailId: Type.String({ format: 'uuid' }), modules: Type.Array(moduleProgressSchema) }, { additionalProperties: false })
export const errorResponseSchema = Type.Object({ code: Type.String(), message: Type.String() }, { additionalProperties: false })
