import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthenticationError, getAuthenticatedUser } from '../../lib/auth-user.js'
import type { AssignInviteBody, RewardKeyParams, UpdateProfileBody } from './community.schemas.js'
import {
  CommunityError,
  assignInvite,
  getInvite,
  getProfile,
  getRanking,
  getRewards,
  redeemReward,
  updateProfile,
} from './community.service.js'

function statusFor(code: CommunityError['code']): number {
  if (code === 'REWARD_NOT_FOUND' || code === 'INVITE_INVALID') return 404
  if (code === 'INSUFFICIENT_BALANCE' || code === 'VALIDATED_REPORTS_REQUIRED' || code === 'REWARD_NOT_REDEEMABLE') {
    return 422
  }
  if (code === 'INVITE_ALREADY_ATTRIBUTED') return 409
  return 400
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthenticationError) {
    return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
  }
  if (error instanceof CommunityError) {
    return reply.status(statusFor(error.code)).send({ code: error.code, message: error.message })
  }
  throw error
}

async function withAuth<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  operation: (userId: string) => Promise<T>,
  status = 200,
) {
  try {
    const user = await getAuthenticatedUser(request.headers.authorization)
    const result = await operation(user.id)
    return reply.status(status).send(result)
  } catch (error) {
    return sendError(reply, error)
  }
}

export async function getRankingController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getRanking(userId))
}

export async function getRewardsController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getRewards(userId))
}

export async function redeemRewardController(
  request: FastifyRequest<{ Params: RewardKeyParams }>,
  reply: FastifyReply,
) {
  return withAuth(request, reply, (userId) => redeemReward(userId, request.params.key), 201)
}

export async function getInviteController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getInvite(userId))
}

export async function assignInviteController(
  request: FastifyRequest<{ Body: AssignInviteBody }>,
  reply: FastifyReply,
) {
  return withAuth(request, reply, (userId) => assignInvite(userId, request.body.inviteCode), 201)
}

export async function getProfileController(request: FastifyRequest, reply: FastifyReply) {
  return withAuth(request, reply, (userId) => getProfile(userId))
}

export async function updateProfileController(
  request: FastifyRequest<{ Body: UpdateProfileBody }>,
  reply: FastifyReply,
) {
  return withAuth(request, reply, (userId) => updateProfile(userId, request.body))
}
