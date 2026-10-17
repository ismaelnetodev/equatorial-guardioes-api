import type { Prisma } from '../../generated/prisma/client.js'
import { getPrisma } from '../../lib/prisma.js'
import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { gradeAnswers, QuizError, toPublicQuestions } from './quiz.service.js'
import type { SubmitPreTest } from './quiz.schemas.js'
import { assertRetry, awardOnce, configuration, LearningError, learningTransaction, minimumCorrect } from './learning-rules.service.js'

async function examContext(tx: Prisma.TransactionClient, userId: string, trailId: string, now: Date) {
  const trail = await tx.trail.findUnique({
    where: { id: trailId, ...publishedTrailWhere },
    select: { modules: { where: publishedModuleWhere, orderBy: { order: 'asc' }, select: {
      progressRecords: { where: { userId }, select: { completedAt: true } },
      quizQuestions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { createdAt: 'asc' } } } },
    } } },
  })
  if (!trail) throw new QuizError('MODULE_NOT_FOUND', 'Trilha não encontrada.')
  if (!trail.modules.length || trail.modules.some(module => !module.progressRecords[0]?.completedAt)) {
    throw new LearningError('FINAL_EXAM_LOCKED', 'Conclua todos os módulos antes da prova final.')
  }
  const delay = await configuration(tx, 'final_exam_delay', 'LIMIT')
  const lastCompletion = Math.max(...trail.modules.map(module => module.progressRecords[0]!.completedAt!.getTime()))
  if (delay.isActive && now.getTime() < lastCompletion + delay.value! * 3600000) {
    throw new LearningError('FINAL_EXAM_LOCKED', 'Aguarde o prazo configurado após concluir o último módulo.')
  }
  const previous = await tx.finalExamAttempt.findFirst({ where: { userId, trailId }, orderBy: { submittedAt: 'desc' } })
  await assertRetry(tx, previous?.submittedAt ?? null, now)
  const questions = trail.modules.flatMap(module => module.quizQuestions)
  if (!questions.length) throw new QuizError('QUIZ_EMPTY', 'A trilha ainda não possui perguntas para a prova final.')
  return { questions }
}

export async function getFinalExam(userId: string, trailId: string) {
  const { questions } = await examContext(getPrisma(), userId, trailId, new Date())
  return { trailId, totalCount: questions.length, minimumCorrect: await minimumCorrect(getPrisma(), questions.length), questions: toPublicQuestions(questions) }
}

export async function submitFinalExam(userId: string, trailId: string, input: SubmitPreTest) {
  return learningTransaction(async tx => {
    const now = new Date()
    const { questions } = await examContext(tx, userId, trailId, now)
    const { correctCount, totalCount } = gradeAnswers(questions, input.answers)
    const minCorrect = await minimumCorrect(tx, totalCount)
    const isApproved = correctCount >= minCorrect
    let pointsAwarded = 0
    if (isApproved) {
      const limit = await configuration(tx, 'final_exam_awards', 'LIMIT')
      const count = await tx.learningAward.count({ where: { userId, trailId, ruleKey: 'final_exam' } })
      if (!limit.isActive || count < limit.value!) pointsAwarded = await awardOnce(tx, { userId, trailId, ruleKey: 'final_exam', sourceId: trailId }, now)
    }
    const attempt = await tx.finalExamAttempt.create({ data: { userId, trailId, correctCount, totalCount, minimumCorrect: minCorrect, isApproved, pointsAwarded } })
    return { attemptId: attempt.id, trailId, correctCount, totalCount, minimumCorrect: minCorrect, isApproved, pointsAwarded }
  })
}
