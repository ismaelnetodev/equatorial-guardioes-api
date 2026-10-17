import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthError, getCurrentUser, loginUser, registerUser } from './auth.service.js'
import { AuthenticationError } from '../../lib/auth-user.js'
import { createSessionToken } from '../../lib/auth-session.js'
import type { Credentials, LoginCredentials } from './auth.schemas.js'

function sendAuthError(reply: FastifyReply, error: AuthError) {
  const statusCode = error.code === 'CONTACT_ALREADY_REGISTERED' ? 409 : error.code === 'CONTACT_REQUIRED' || error.code === 'INVALID_NEIGHBORHOOD' ? 400 : 401
  return reply.status(statusCode).send({ code: error.code, message: error.message })
}

export async function currentUserController(request: FastifyRequest, reply: FastifyReply) {
  try { return await getCurrentUser(request.headers.authorization) }
  catch (error) {
    if (error instanceof AuthenticationError) return reply.status(401).send({ code: 'UNAUTHENTICATED', message: error.message })
    throw error
  }
}

export async function registerController(request: FastifyRequest<{ Body: Credentials }>, reply: FastifyReply) {
  try {
    const user = await registerUser(request.body)
    return reply.status(201).send({ message: 'Cadastro realizado com sucesso.', user })
  } catch (error) {
    if (error instanceof AuthError) return sendAuthError(reply, error)
    throw error
  }
}

export async function loginController(request: FastifyRequest<{ Body: LoginCredentials }>, reply: FastifyReply) {
  try {
    const user = await loginUser(request.body)
    return reply.send({ message: 'Login realizado com sucesso.', user, accessToken: createSessionToken(user.id) })
  } catch (error) {
    if (error instanceof AuthError) return sendAuthError(reply, error)
    throw error
  }
}
