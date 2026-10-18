import { type Static, Type } from 'typebox'

const uuid = Type.String({ format: 'uuid' })
const title = Type.String({ minLength: 1, maxLength: 200, pattern: "\\S" })
const description = Type.String({ minLength: 1, maxLength: 5000, pattern: "\\S" })
const content = Type.String({ maxLength: 200000 })
const duration = Type.Union([Type.Integer({ minimum: 1, maximum: 100000 }), Type.Null()])
export const contentStatusSchema = Type.Union([Type.Literal('DRAFT'), Type.Literal('PUBLISHED'), Type.Literal('ARCHIVED'), Type.Literal('DISABLED')])
export type ContentStatus = Static<typeof contentStatusSchema>
export const adminTrailParamsSchema = Type.Object({ trailId: uuid }, { additionalProperties: false })
export const adminModuleParamsSchema = Type.Object({ trailId: uuid, moduleId: uuid }, { additionalProperties: false })
export type AdminTrailParams = Static<typeof adminTrailParamsSchema>
export type AdminModuleParams = Static<typeof adminModuleParamsSchema>
export const createTrailSchema = Type.Object({ title, description }, { additionalProperties: false })
export const updateTrailSchema = Type.Partial(createTrailSchema, { additionalProperties: false, minProperties: 1 })
export type CreateTrail = Static<typeof createTrailSchema>
export type UpdateTrail = Static<typeof updateTrailSchema>
export const createModuleSchema = Type.Object({
  title,
  description,
  content: Type.Optional(content),
  durationMinutes: Type.Optional(duration),
  requiresQuiz: Type.Optional(Type.Boolean()),
  quizMinimumScore: Type.Optional(Type.Union([Type.Number({ minimum: 0, maximum: 1, description: 'Campo legado; aprovação usa quiz_pass_score no painel de pontos e limites.' }), Type.Null()])),
}, { additionalProperties: false })
export const updateModuleSchema = Type.Partial(createModuleSchema, { additionalProperties: false, minProperties: 1 })
export type CreateModule = Static<typeof createModuleSchema>
export type UpdateModule = Static<typeof updateModuleSchema>
export const changeStatusSchema = Type.Object({ status: contentStatusSchema }, { additionalProperties: false })
export type ChangeStatus = Static<typeof changeStatusSchema>
export const reorderSchema = Type.Object({ ids: Type.Array(uuid, { minItems: 1, maxItems: 10000, uniqueItems: true, description: 'Todos os IDs da coleção, incluindo conteúdos não publicados, na ordem desejada' }) }, { additionalProperties: false })
export type Reorder = Static<typeof reorderSchema>
export const adminTrailSchema = Type.Object({ id: uuid, title: Type.String(), description: Type.String(), order: Type.Integer({ minimum: 1 }), publicationStatus: contentStatusSchema }, { additionalProperties: false })
export const adminModuleSchema = Type.Object({
  id: uuid,
  trailId: uuid,
  title: Type.String(),
  description: Type.String(),
  content: Type.String(),
  order: Type.Integer({ minimum: 1 }),
  publicationStatus: contentStatusSchema,
  durationMinutes: duration,
  isActive: Type.Boolean(),
  requiresQuiz: Type.Boolean(),
  quizMinimumScore: Type.Union([Type.Number({ minimum: 0, maximum: 1 }), Type.Null()]),
}, { additionalProperties: false })
export const adminTrailDetailsSchema = Type.Object({ ...adminTrailSchema.properties, modules: Type.Array(adminModuleSchema) }, { additionalProperties: false })
export const adminTrailsSchema = Type.Array(adminTrailSchema)
export const adminModulesSchema = Type.Array(adminModuleSchema)
export const adminErrorSchema = Type.Object({ code: Type.String(), message: Type.String() }, { additionalProperties: false })
export const changePasswordSchema = Type.Object({ currentPassword: Type.String({ minLength: 1, maxLength: 128 }), newPassword: Type.String({ minLength: 8, maxLength: 128 }) }, { additionalProperties: false })
export type ChangePassword = Static<typeof changePasswordSchema>
export const passwordChangedSchema = Type.Object({ message: Type.String() })

const nonEmptyText = Type.String({ minLength: 1, pattern: '\\S' })

export const adminQuizOptionInputSchema = Type.Object({
  text: nonEmptyText,
  isCorrect: Type.Boolean(),
}, { additionalProperties: false })

export const adminQuizQuestionInputSchema = Type.Object({
  phase: Type.Optional(Type.Union([Type.Literal('PRE'), Type.Literal('POST'), Type.Null()])),
  statement: nonEmptyText,
  explanationTitle: nonEmptyText,
  explanationBody: nonEmptyText,
  imageUrl: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  options: Type.Array(adminQuizOptionInputSchema, { minItems: 2, maxItems: 8 }),
}, { additionalProperties: false })

export const replaceQuizSchema = Type.Object({
  questions: Type.Array(adminQuizQuestionInputSchema, { maxItems: 50 }),
}, { additionalProperties: false })
export type ReplaceQuiz = Static<typeof replaceQuizSchema>

export const adminQuizOptionSchema = Type.Object({
  id: uuid,
  text: Type.String(),
  isCorrect: Type.Boolean(),
}, { additionalProperties: false })

export const adminQuizQuestionSchema = Type.Object({
  phase: Type.Optional(Type.Union([Type.Literal('PRE'), Type.Literal('POST'), Type.Null()])),
  id: uuid,
  statement: Type.String(),
  order: Type.Integer({ minimum: 1 }),
  explanationTitle: Type.String(),
  explanationBody: Type.String(),
  imageUrl: Type.Union([Type.String(), Type.Null()]),
  options: Type.Array(adminQuizOptionSchema),
}, { additionalProperties: false })

export const adminQuizSchema = Type.Object({
  moduleId: uuid,
  questions: Type.Array(adminQuizQuestionSchema),
}, { additionalProperties: false })

export const trainingStepKindSchema = Type.Union([Type.Literal('RECOGNIZE'), Type.Literal('DO_NOT'), Type.Literal('INFO')])

export const adminTrainingCardInputSchema = Type.Object({
  title: nonEmptyText,
  description: nonEmptyText,
}, { additionalProperties: false })

export const adminTrainingStepInputSchema = Type.Object({
  title: nonEmptyText,
  kind: Type.Optional(trainingStepKindSchema),
  durationMinutes: Type.Optional(duration),
  introText: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  cards: Type.Array(adminTrainingCardInputSchema, { maxItems: 20 }),
}, { additionalProperties: false })

export const replaceTrainingSchema = Type.Object({
  steps: Type.Array(adminTrainingStepInputSchema, { maxItems: 20 }),
}, { additionalProperties: false })
export type ReplaceTraining = Static<typeof replaceTrainingSchema>

export const adminTrainingCardSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  description: Type.String(),
  order: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false })

export const adminTrainingStepSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  kind: trainingStepKindSchema,
  order: Type.Integer({ minimum: 1 }),
  durationMinutes: duration,
  introText: Type.Union([Type.String(), Type.Null()]),
  cards: Type.Array(adminTrainingCardSchema),
}, { additionalProperties: false })

export const adminTrainingSchema = Type.Object({
  moduleId: uuid,
  steps: Type.Array(adminTrainingStepSchema),
}, { additionalProperties: false })

export {
  adminReportEmergencyBodySchema,
  adminReportEmergencyResponseSchema,
  adminReportItemSchema,
  adminReportStatusBodySchema,
  adminReportsListSchema,
  adminReportsQuerySchema,
  reportParamsSchema,
} from '../reports/reports.schemas.js'
export type { AdminReportEmergencyBody, AdminReportStatusBody, AdminReportsQuery, ReportParams } from '../reports/reports.schemas.js'
