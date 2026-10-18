import { type Static, Type } from 'typebox'
import type { MultipartFile } from '@fastify/multipart'

export const uploadReportPhotoSchema = Type.Object({ foto: Type.Unsafe<MultipartFile>({ isFile: true }) }, { additionalProperties: false })
export type UploadReportPhoto = Static<typeof uploadReportPhotoSchema>
export const uploadReportPhotoResponseSchema = Type.Object({ photoUrl: Type.String() }, { additionalProperties: false })

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
  neighborhood: Type.Optional(Type.String({ maxLength: 100 })),
  neighborhoodId: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
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

export const adminReportEmergencyBodySchema = Type.Object({
  requiresEmergencyTeam: Type.Unsafe<boolean | null>({ type: ['boolean', 'null'] }),
}, { additionalProperties: false })
export type AdminReportEmergencyBody = Static<typeof adminReportEmergencyBodySchema>
export const adminReportEmergencyResponseSchema = Type.Object({
  id: uuid,
  requiresEmergencyTeam: Type.Unsafe<boolean | null>({ type: ['boolean', 'null'] }),
}, { additionalProperties: false })

export const adminReportsQuerySchema = Type.Object({
  status: Type.Optional(reportStatusCodeSchema),
}, { additionalProperties: false })
export type AdminReportsQuery = Static<typeof adminReportsQuerySchema>

export const adminReportItemSchema = Type.Object({
  requiresEmergencyTeam: Type.Unsafe<boolean | null>({ type: ['boolean', 'null'] }),
  id: uuid,
  userId: uuid,
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
  impactSeenAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  submittedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false })

export const adminReportsListSchema = Type.Array(adminReportItemSchema)
