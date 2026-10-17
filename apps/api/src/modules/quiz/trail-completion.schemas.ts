import { Type } from 'typebox'
const date = Type.String({ format: 'date-time' })
const nullableDate = Type.Union([date, Type.Null()])
export const certificateSchema = Type.Object({ id: Type.String({ format: 'uuid' }), holderName: Type.String(), trailTitle: Type.String(), issuedAt: date, badge: Type.String() })
export const trailCompletionSchema = Type.Object({
  trailId: Type.String({ format: 'uuid' }), title: Type.String(), completedModules: Type.Integer(), totalModules: Type.Integer(),
  finalExam: Type.Object({
    status: Type.Union([Type.Literal('APPROVED'), Type.Literal('MODULES_PENDING'), Type.Literal('QUESTIONS_PENDING'), Type.Literal('WAITING'), Type.Literal('RETRY_WAITING'), Type.Literal('AVAILABLE')]),
    availableAt: nullableDate, retryAt: nullableDate, totalQuestions: Type.Integer(), minimumPercent: Type.Integer(),
    lastResult: Type.Union([Type.Object({ correctCount: Type.Integer(), totalCount: Type.Integer(), minimumCorrect: Type.Integer(), isApproved: Type.Boolean(), pointsAwarded: Type.Integer() }), Type.Null()]),
  }),
  certificate: Type.Union([certificateSchema, Type.Null()]), canIssueCertificate: Type.Boolean(),
})
