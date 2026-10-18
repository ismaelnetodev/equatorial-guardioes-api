import { type Static, Type } from 'typebox'

export const errorResponseSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
)

const levelSchema = Type.Object(
  {
    code: Type.Union([
      Type.Literal('BRONZE'),
      Type.Literal('SILVER'),
      Type.Literal('GOLD'),
      Type.Literal('PLATINUM'),
    ]),
    name: Type.String(),
    nextLevel: Type.Union([
      Type.Object({
        code: Type.Union([
          Type.Literal('BRONZE'),
          Type.Literal('SILVER'),
          Type.Literal('GOLD'),
          Type.Literal('PLATINUM'),
        ]),
        name: Type.String(),
      }),
      Type.Null(),
    ]),
    pointsToNextLevel: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  },
  { additionalProperties: false },
)

export const rankingResponseSchema = Type.Object(
  {
    neighborhoods: Type.Array(
      Type.Object(
        {
          rank: Type.Integer({ minimum: 1 }),
          neighborhood: Type.String(),
          accumulatedPoints: Type.Integer({ minimum: 0 }),
          guardiansCount: Type.Integer({ minimum: 0 }),
          isCurrentUserNeighborhood: Type.Boolean(),
        },
        { additionalProperties: false },
      ),
    ),
    yourContribution: Type.Object(
      {
        accumulatedPoints: Type.Integer({ minimum: 0 }),
        neighborhoodSharePercent: Type.Number({ minimum: 0, maximum: 100 }),
        neighborhood: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

export const rewardsResponseSchema = Type.Object(
  {
    balance: Type.Integer({ minimum: 0 }),
    accumulated: Type.Integer({ minimum: 0 }),
    level: levelSchema,
    rewards: Type.Array(
      Type.Object(
        {
          key: Type.String(),
          name: Type.String(),
          description: Type.String(),
          cost: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
          unit: Type.String(),
          canRedeem: Type.Boolean(),
          pointsMissing: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

export const rewardKeyParamsSchema = Type.Object(
  {
    key: Type.String({ minLength: 1, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' }),
  },
  { additionalProperties: false },
)

export const redeemResponseSchema = Type.Object(
  {
    redemptionId: Type.String({ format: 'uuid' }),
    rewardKey: Type.String(),
    pointsSpent: Type.Integer({ minimum: 1 }),
    balance: Type.Integer({ minimum: 0 }),
    accumulated: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)

export const inviteResponseSchema = Type.Object(
  {
    inviteCode: Type.String(),
    inviteLimit: Type.Integer({ minimum: 0 }),
    stats: Type.Object(
      {
        registeredCount: Type.Integer({ minimum: 0 }),
        module0CompletedCount: Type.Integer({ minimum: 0 }),
        pointsFromInvites: Type.Integer({ minimum: 0 }),
        rewardedInviteCount: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

export const assignInviteBodySchema = Type.Object(
  {
    inviteCode: Type.String({ minLength: 3, maxLength: 50 }),
  },
  { additionalProperties: false },
)

export const assignInviteResponseSchema = Type.Object(
  {
    attributed: Type.Boolean(),
    inviteCode: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
)

export const profileResponseSchema = Type.Object(
  {
    name: Type.String(),
    neighborhood: Type.String(),
    level: levelSchema,
    accumulated: Type.Integer({ minimum: 0 }),
    balance: Type.Integer({ minimum: 0 }),
    canReport: Type.Boolean({ description: 'true quando o módulo inicial da trilha foi concluído' }),
    badges: Type.Object(
      {
        modulesCompleted: Type.Integer({ minimum: 0 }),
        modulesPublished: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    reportsCount: Type.Integer({ minimum: 0 }),
    shortcuts: Type.Object(
      {
        ranking: Type.Literal('/ranking'),
        rewards: Type.Literal('/recompensas'),
        invite: Type.Literal('/convidar'),
        reports: Type.Literal('/relatos'),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

export const updateProfileBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 2, maxLength: 100 })),
    neighborhood: Type.Optional(Type.String({ minLength: 2, maxLength: 100 })),
    neighborhoodId: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  },
  { additionalProperties: false, minProperties: 1 },
)

export type RewardKeyParams = Static<typeof rewardKeyParamsSchema>
export type AssignInviteBody = Static<typeof assignInviteBodySchema>
export type UpdateProfileBody = Static<typeof updateProfileBodySchema>
