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
export const trailProgressResponseSchema = Type.Object({
  trailId: Type.String({ format: 'uuid' }),
  modules: Type.Array(moduleProgressSchema),
  canReport: Type.Boolean({ description: 'true quando o módulo inicial da trilha foi concluído' }),
}, { additionalProperties: false })
export const errorResponseSchema = Type.Object({ code: Type.String(), message: Type.String() }, { additionalProperties: false })
const optionalLimit = Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])
export const learningSummarySchema = Type.Object({
  totalPoints: Type.Integer({ minimum: 0 }), pendingPoints: Type.Integer({ minimum: 0 }), modulePoints: Type.Integer({ minimum: 0 }),
  dailyModuleLimit: optionalLimit, dailyPointsLimit: optionalLimit,
  nextReleaseAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
})
export const learningHistoryQuerySchema = Type.Object({ offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 2147483647, default: 0 })), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })) }, { additionalProperties: false })
export type LearningHistoryQuery = Static<typeof learningHistoryQuerySchema>
export const learningHistorySchema = Type.Array(Type.Object({
  id: Type.String({ format: 'uuid' }), ruleKey: Type.String(), description: Type.String(),
  moduleId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]), trailId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  points: Type.Integer({ minimum: 0 }), status: Type.Union([Type.Literal('GRANTED'), Type.Literal('PENDING')]),
  createdAt: Type.String({ format: 'date-time' }), grantedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
}))
