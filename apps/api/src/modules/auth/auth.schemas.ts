import { type Static, Type } from 'typebox'

export const credentialsSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 100, description: 'Nome completo do usuário' }),
    email: Type.Optional(Type.String({ format: 'email', maxLength: 254, description: 'E-mail do usuário' })),
    cellphone: Type.Optional(Type.String({ pattern: '^\\+?[1-9]\\d{7,14}$', description: 'Celular no formato internacional, apenas números e + opcional' })),
    password: Type.String({ minLength: 8, maxLength: 128, description: 'Senha do usuário' }),
    neighborhood: Type.String({ minLength: 2, maxLength: 100, description: 'Bairro onde o usuário reside' }),
    neighborhoodId: Type.Optional(Type.String({ minLength: 1, maxLength: 50, description: 'ID do catálogo. Omitir para Outro bairro.' })),
    inviteCode: Type.Optional(Type.String({ minLength: 3, maxLength: 50, description: 'Código de convite, se houver' })),
    acceptedTerms: Type.Literal(true, { description: 'Confirma o aceite dos Termos de Uso e da Política de Privacidade' }),
  },
  { additionalProperties: false },
)

export type Credentials = Static<typeof credentialsSchema>

export const loginSchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email', maxLength: 254, description: 'E-mail do usuário' })),
    cellphone: Type.Optional(Type.String({ pattern: '^\\+?[1-9]\\d{7,14}$', description: 'Celular no formato internacional, apenas números e + opcional' })),
    password: Type.String({ minLength: 1, maxLength: 128, description: 'Senha atual do usuário; contas temporárias podem ter senhas legadas' }),
  },
  { additionalProperties: false },
)

export type LoginCredentials = Static<typeof loginSchema>

export const authenticatedUserSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    name: Type.String(),
    email: Type.Optional(Type.String({ format: 'email' })),
    cellphone: Type.Optional(Type.String()),
    neighborhood: Type.String(),
  },
  { additionalProperties: false },
)

export const registerResponseSchema = Type.Object(
  {
    message: Type.String(),
    user: authenticatedUserSchema,
  },
  { additionalProperties: false },
)

export const authResponseSchema = Type.Object(
  {
    message: Type.String(),
    user: authenticatedUserSchema,
    accessToken: Type.String({ description: 'Token Bearer para rotas autenticadas' }),
  },
  { additionalProperties: false },
)

export const errorResponseSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
)
