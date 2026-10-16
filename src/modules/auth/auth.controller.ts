import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthError, loginUser, registerUser } from './auth.service.js'
import type { Credentials, LoginCredentials } from './auth.schemas.js'

function sendAuthError(reply: FastifyReply, error: AuthError) {
  const statusCode = error.code === 'CONTACT_ALREADY_REGISTERED' ? 409 : error.code === 'CONTACT_REQUIRED' ? 400 : 401
  return reply.status(statusCode).send({ code: error.code, message: error.message })
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
    return reply.send({ message: 'Login realizado com sucesso.', user })
  } catch (error) {
    if (error instanceof AuthError) return sendAuthError(reply, error)
    throw error
  }
}
