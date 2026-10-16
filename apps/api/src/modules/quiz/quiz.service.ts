export interface QuizCompletionContext {
  userId: string
  moduleId: string
}

export type QuizCompletionStatus = 'approved' | 'not_approved' | 'unavailable'

/**
 * Ponto de integração para o módulo de quiz.
 * A implementação futura deve consultar a aprovação no servidor para o usuário
 * e módulo informados, sem confiar em notas ou aprovações enviadas pelo cliente.
 */
export async function getQuizCompletionStatus(_context: QuizCompletionContext): Promise<QuizCompletionStatus> {
  // TODO: integrar com a implementação do quiz. Até lá, impedir a conclusão.
  return 'unavailable'
}
