import { Type } from 'typebox'

export const neighborhoodQuerySchema = Type.Object({
  municipalityCode: Type.Optional(Type.String({ pattern: '^\\d{7}$', default: '2111300' })),
}, { additionalProperties: false })
export const neighborhoodsResponseSchema = Type.Object({
  neighborhoods: Type.Array(Type.Object({
    id: Type.String(), name: Type.String(), municipalityCode: Type.String(),
    municipalityName: Type.String(), state: Type.String(), source: Type.String(),
  }, { additionalProperties: false })),
}, { additionalProperties: false })
