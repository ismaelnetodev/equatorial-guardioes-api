import { type Static, Type } from 'typebox'

const uuid = Type.String({ format: 'uuid' })

export const moduleParamsSchema = Type.Object({ moduleId: uuid }, { additionalProperties: false })
export type ModuleParams = Static<typeof moduleParamsSchema>

export const errorResponseSchema = Type.Object({ code: Type.String(), message: Type.String() }, { additionalProperties: false })

export const stageStatusSchema = Type.Union([
  Type.Literal('locked'),
  Type.Literal('available'),
  Type.Literal('completed'),
])

const moduleCompletionPointsSchema = Type.Object({
  pointsAwarded: Type.Integer({ minimum: 0 }),
  pendingPoints: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false })

export const learnStateSchema = Type.Object({
  moduleId: uuid,
  preTest: Type.Object({
    status: stageStatusSchema,
    correctCount: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    totalCount: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    pointsAwarded: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }),
  training: Type.Object({
    status: stageStatusSchema,
    pointsAwarded: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }),
  postTest: Type.Object({
    status: stageStatusSchema,
    correctCount: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    totalCount: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    isApproved: Type.Union([Type.Boolean(), Type.Null()]),
    pointsAwarded: Type.Integer({ minimum: 0 }),
    minimumCorrect: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }),
  totalPoints: Type.Integer({ minimum: 0 }),
  moduleCompletion: moduleCompletionPointsSchema,
}, { additionalProperties: false })
export type LearnState = Static<typeof learnStateSchema>

export const publicQuizOptionSchema = Type.Object({
  id: uuid,
  text: Type.String(),
  order: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false })

export const publicQuizQuestionSchema = Type.Object({
  id: uuid,
  statement: Type.String(),
  order: Type.Integer({ minimum: 1 }),
  imageUrl: Type.Union([Type.String(), Type.Null()]),
  options: Type.Array(publicQuizOptionSchema),
}, { additionalProperties: false })

export const quizQuestionsResponseSchema = Type.Object({
  moduleId: uuid,
  phase: Type.Union([Type.Literal('PRE'), Type.Literal('POST')]),
  attemptId: Type.Optional(uuid),
  answeredCount: Type.Optional(Type.Integer({ minimum: 0 })),
  totalCount: Type.Integer({ minimum: 0 }),
  questions: Type.Array(publicQuizQuestionSchema),
}, { additionalProperties: false })

export const quizAnswerItemSchema = Type.Object({
  questionId: uuid,
  optionId: uuid,
}, { additionalProperties: false })

export const submitPreTestSchema = Type.Object({
  answers: Type.Array(quizAnswerItemSchema, { minItems: 1 }),
}, { additionalProperties: false })
export type SubmitPreTest = Static<typeof submitPreTestSchema>

export const preTestResultSchema = Type.Object({
  moduleId: uuid,
  attemptId: uuid,
  correctCount: Type.Integer({ minimum: 0 }),
  totalCount: Type.Integer({ minimum: 1 }),
  pointsAwarded: Type.Integer({ minimum: 0 }),
  title: Type.String(),
  message: Type.String(),
  hint: Type.String(),
}, { additionalProperties: false })
export type PreTestResult = Static<typeof preTestResultSchema>

export const finishPostTestSchema = Type.Object({ attemptId: uuid }, { additionalProperties: false })
export type FinishPostTest = Static<typeof finishPostTestSchema>

export const submitPostAnswerSchema = Type.Object({
  attemptId: uuid,
  questionId: uuid,
  optionId: uuid,
}, { additionalProperties: false })
export type SubmitPostAnswer = Static<typeof submitPostAnswerSchema>

export const postAnswerFeedbackSchema = Type.Object({
  attemptId: uuid,
  questionId: uuid,
  selectedOptionId: uuid,
  correctOptionId: uuid,
  isCorrect: Type.Boolean(),
  feedbackKind: Type.Union([Type.Literal('correct'), Type.Literal('incorrect')]),
  feedback: Type.Object({
    title: Type.String(),
    body: Type.String(),
  }, { additionalProperties: false }),
  answeredCount: Type.Integer({ minimum: 0 }),
  totalCount: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false })
export type PostAnswerFeedback = Static<typeof postAnswerFeedbackSchema>

export const scoreSummarySchema = Type.Object({
  correctCount: Type.Integer({ minimum: 0 }),
  totalCount: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false })

export const postTestResultSchema = Type.Object({
  moduleId: uuid,
  attemptId: uuid,
  correctCount: Type.Integer({ minimum: 0 }),
  totalCount: Type.Integer({ minimum: 1 }),
  isApproved: Type.Boolean(),
  minimumCorrect: Type.Integer({ minimum: 0 }),
  pointsAwarded: Type.Integer({ minimum: 0 }),
  totalPoints: Type.Integer({ minimum: 0 }),
  moduleCompletion: moduleCompletionPointsSchema,
  before: scoreSummarySchema,
  after: scoreSummarySchema,
  title: Type.String(),
  message: Type.String(),
  reviewHint: Type.Union([Type.String(), Type.Null()]),
  pointsBreakdown: Type.Object({
    preTest: Type.Integer({ minimum: 0 }),
    training: Type.Integer({ minimum: 0 }),
    postTest: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }),
}, { additionalProperties: false })
export type PostTestResult = Static<typeof postTestResultSchema>

export const trainingCardSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  description: Type.String(),
  order: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false })

export const trainingStepSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  kind: Type.Union([Type.Literal('RECOGNIZE'), Type.Literal('DO_NOT'), Type.Literal('INFO')]),
  order: Type.Integer({ minimum: 1 }),
  durationMinutes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  introText: Type.Union([Type.String(), Type.Null()]),
  cards: Type.Array(trainingCardSchema),
}, { additionalProperties: false })

export const trainingResponseSchema = Type.Object({
  moduleId: uuid,
  completed: Type.Boolean(),
  pointsAwarded: Type.Integer({ minimum: 0 }),
  steps: Type.Array(trainingStepSchema),
}, { additionalProperties: false })

export const trainingCompleteResponseSchema = Type.Object({
  moduleId: uuid,
  completed: Type.Literal(true),
  pointsAwarded: Type.Integer({ minimum: 0 }),
  pointsCapped: Type.Boolean({ description: 'true quando o crédito ficou na fila por limite diário' }),
  capReason: Type.Union([Type.Literal('DAILY_LIMIT'), Type.Null()]),
  pendingPoints: Type.Integer({ minimum: 0, description: 'Pontos de treino ainda na fila do usuário' }),
}, { additionalProperties: false })
