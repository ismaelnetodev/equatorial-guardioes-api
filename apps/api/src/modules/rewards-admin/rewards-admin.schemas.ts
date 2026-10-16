import { type Static, Type } from 'typebox'

const key = Type.String({ minLength: 1, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' })
const value = Type.Union([Type.Integer({ minimum: 0, maximum: 2147483647 }), Type.Null()])
export const paramsSchema = Type.Object({ key }, { additionalProperties: false })
export const updateSchema = Type.Object({
  value: Type.Optional(value),
  isActive: Type.Optional(Type.Boolean()),
  reason: Type.Optional(Type.String({ minLength: 1, maxLength: 2000, pattern: '\\S' })),
}, { additionalProperties: false, anyOf: [{ required: ['value'] }, { required: ['isActive'] }] })
export const configurationSchema = Type.Object({
  key, kind: Type.Union([Type.Literal('RULE'), Type.Literal('REWARD'), Type.Literal('LIMIT')]),
  name: Type.String(), description: Type.String(), value, unit: Type.String(),
  isActive: Type.Boolean(), updatedAt: Type.String({ format: 'date-time' }),
})
export const configurationsSchema = Type.Array(configurationSchema)
export const historyQuerySchema = Type.Object({
  key: Type.Optional(key),
  kind: Type.Optional(Type.Union([Type.Literal('RULE'), Type.Literal('REWARD'), Type.Literal('LIMIT')])),
  offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 2147483647, default: 0 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
}, { additionalProperties: false })
export const historySchema = Type.Array(Type.Object({
  id: Type.String({ format: 'uuid' }), key, kind: configurationSchema.properties.kind,
  before: Type.Union([configurationSchema, Type.Null()]), after: configurationSchema,
  actorId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  reason: Type.Union([Type.String(), Type.Null()]), createdAt: Type.String({ format: 'date-time' }),
}))
export const errorSchema = Type.Object({ code: Type.String(), message: Type.String() })
export type UpdateConfiguration = Static<typeof updateSchema>
export type ConfigurationParams = Static<typeof paramsSchema>
export type HistoryQuery = Static<typeof historyQuerySchema>
