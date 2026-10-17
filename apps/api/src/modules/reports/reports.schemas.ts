import { type Static, Type } from 'typebox'

const uuid = Type.String({ format: 'uuid' })
const nonEmpty = Type.String({ minLength: 1, pattern: '\\S' })

export const reportStatusCodeSchema = Type.Union([
  Type.Literal('SENT'),
  Type.Literal('RECEIVED'),
  Type.Literal('IN_ANALYSIS'),
  Type.Literal('RESOLVED'),
  Type.Literal('NOT_CONFIRMED'),
])
export type ReportStatusCode = Static<typeof reportStatusCodeSchema>

export const reportUrgencySchema = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
])
export type ReportUrgencyCode = Static<typeof reportUrgencySchema>

export const statusViewSchema = Type.Object({
  code: reportStatusCodeSchema,
  label: Type.String(),
  iconHint: Type.String(),
}, { additionalProperties: false })

export const urgencyViewSchema = Type.Object({
  code: reportUrgencySchema,
  label: Type.String(),
  iconHint: Type.String(),
}, { additionalProperties: false })

export const errorResponseSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
}, { additionalProperties: false })

export const createReportSchema = Type.Object({
  title: nonEmpty,
  description: nonEmpty,
  address: nonEmpty,
  neighborhood: nonEmpty,
  photoUrl: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  latitude: Type.Optional(Type.Union([Type.Number({ minimum: -90, maximum: 90 }), Type.Null()])),
  longitude: Type.Optional(Type.Union([Type.Number({ minimum: -180, maximum: 180 }), Type.Null()])),
  urgency: Type.Optional(reportUrgencySchema),
}, { additionalProperties: false })
export type CreateReport = Static<typeof createReportSchema>

export const reportParamsSchema = Type.Object({ reportId: uuid }, { additionalProperties: false })
export type ReportParams = Static<typeof reportParamsSchema>

export const timelineEventSchema = Type.Object({
  status: statusViewSchema,
  occurredAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  pending: Type.Boolean(),
}, { additionalProperties: false })

export const reportListItemSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  address: Type.String(),
  neighborhood: Type.String(),
  photoUrl: Type.Union([Type.String(), Type.Null()]),
  status: statusViewSchema,
  urgency: urgencyViewSchema,
  pointsAwarded: Type.Integer({ minimum: 0 }),
  submittedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false })

export const reportsSummarySchema = Type.Object({
  sentCount: Type.Integer({ minimum: 0 }),
  resolvedCount: Type.Integer({ minimum: 0 }),
  totalPoints: Type.Integer({ minimum: 0 }),
}, { additionalProperties: false })

export const reportsListResponseSchema = Type.Object({
  summary: reportsSummarySchema,
  reports: Type.Array(reportListItemSchema),
}, { additionalProperties: false })

export const reportDetailSchema = Type.Object({
  id: uuid,
  title: Type.String(),
  description: Type.String(),
  address: Type.String(),
  neighborhood: Type.String(),
  photoUrl: Type.Union([Type.String(), Type.Null()]),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
  status: statusViewSchema,
  urgency: urgencyViewSchema,
  pointsAwarded: Type.Integer({ minimum: 0 }),
  pointsHint: Type.String(),
  submittedAt: Type.String({ format: 'date-time' }),
  timeline: Type.Array(timelineEventSchema),
}, { additionalProperties: false })

export const impactMessageSchema = Type.Object({
  reportId: uuid,
  title: Type.String(),
  message: Type.String(),
  pointsAwarded: Type.Integer({ minimum: 0 }),
  neighborhood: Type.String(),
}, { additionalProperties: false })

export const pendingImpactResponseSchema = Type.Union([impactMessageSchema, Type.Null()])

export const impactSeenResponseSchema = Type.Object({
  reportId: uuid,
  impactSeenAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false })

export const adminReportStatusBodySchema = Type.Object({
  status: reportStatusCodeSchema,
  confirmedRisk: Type.Optional(reportUrgencySchema),
}, { additionalProperties: false })
export type AdminReportStatusBody = Static<typeof adminReportStatusBodySchema>

export const adminReportsQuerySchema = Type.Object({
  status: Type.Optional(reportStatusCodeSchema),
}, { additionalProperties: false })
export type AdminReportsQuery = Static<typeof adminReportsQuerySchema>

export const adminReportItemSchema = Type.Object({
  id: uuid,
  userId: uuid,
  title: Type.String(),
  description: Type.String(),
  address: Type.String(),
  neighborhood: Type.String(),
  photoUrl: Type.Union([Type.String(), Type.Null()]),
  status: statusViewSchema,
  urgency: urgencyViewSchema,
  pointsAwarded: Type.Integer({ minimum: 0 }),
  impactSeenAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  submittedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false })

export const adminReportsListSchema = Type.Array(adminReportItemSchema)
