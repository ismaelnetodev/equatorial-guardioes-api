import { getSessionUserId } from './auth-session.js'
import { getPrisma } from './prisma.js'

export class AuthenticationError extends Error {
  constructor() { super('Usuário não autenticado.') }
}

export async function getAuthenticatedUser(authorization: string | undefined) {
  const userId = getSessionUserId(authorization)
  if (!userId) throw new AuthenticationError()
  // Consultar a cada requisição invalida o acesso de usuários excluídos.
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!user) throw new AuthenticationError()
  return user
}
