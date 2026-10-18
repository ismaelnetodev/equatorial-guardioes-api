import type { Prisma } from '../../generated/prisma/client.js'
import { assertRetry, awardOnce, configuration, learningTransaction, minimumCorrect, moduleAwards, queueTrainingAward, releasePendingModules } from './learning-rules.service.js'
import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { getPrisma } from '../../lib/prisma.js'
import type {
  LearnState,
  FinishPostTest,
  PostAnswerFeedback,
  PostTestResult,
  PreTestResult,
  SubmitPostAnswer,
  SubmitPreTest,
} from './quiz.schemas.js'

export interface QuizCompletionContext {
  userId: string
  moduleId: string
}

export type QuizCompletionStatus = 'approved' | 'not_approved' | 'unavailable'


export class QuizError extends Error {
  constructor(
    public readonly code:
      | 'MODULE_NOT_FOUND'
      | 'MODULE_NOT_STARTED'
      | 'MODULE_LOCKED'
      | 'PRE_TEST_REQUIRED'
      | 'TRAINING_REQUIRED'
      | 'QUIZ_EMPTY'
      | 'INVALID_ANSWERS'
      | 'ATTEMPT_NOT_FOUND'
      | 'ATTEMPT_INCOMPLETE'
      | 'ANSWER_ALREADY_SUBMITTED',
    message: string,
  ) {
    super(message)
  }
}

type PublicOption = { id: string; text: string; order: number }
type PublicQuestion = {
  id: string
  statement: string
  order: number
  imageUrl: string | null
  options: PublicOption[]
}

async function requireAccessibleModule(userId: string, moduleId: string, db: Prisma.TransactionClient = getPrisma(), phase: 'PRE' | 'POST' | null = 'POST') {
  const module = await db.trailModule.findUnique({
    where: { id: moduleId, ...publishedModuleWhere, trail: publishedTrailWhere },
    select: {
      id: true,
      trailId: true,
      isActive: true,
      requiresQuiz: true,
      quizQuestions: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          phase: true,
          statement: true,
          order: true,
          explanationTitle: true,
          explanationBody: true,
          imageUrl: true,
          options: { orderBy: { createdAt: 'asc' }, select: { id: true, text: true, isCorrect: true } },
        },
      },
    },
  })
  if (!module || !module.isActive) throw new QuizError('MODULE_NOT_FOUND', 'Módulo não encontrado.')

  const trail = await db.trail.findUnique({
    where: { id: module.trailId, ...publishedTrailWhere },
    select: {
      id: true,
      modules: {
        where: publishedModuleWhere,
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          progressRecords: { where: { userId }, select: { completedAt: true } },
        },
      },
    },
  })
  if (!trail) throw new QuizError('MODULE_NOT_FOUND', 'Módulo não encontrado.')

  let previousCompleted = true
  for (const item of trail.modules) {
    if (item.id === moduleId) {
      if (!previousCompleted) throw new QuizError('MODULE_LOCKED', 'Conclua o módulo anterior para liberar este módulo.')
      break
    }
    previousCompleted = previousCompleted && Boolean(item.progressRecords[0]?.completedAt)
  }

  const progress = await db.moduleProgress.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      preTestCompletedAt: true,
      trainingCompletedAt: true,
      trainingPointsAwarded: true,
    },
  })
  if (!progress) throw new QuizError('MODULE_NOT_STARTED', 'Inicie o módulo antes de acessar o aprendizado.')

  // Quizzes anteriores à separação das fases continuam compatíveis (phase = null).
  return { module: { ...module, quizQuestions: module.quizQuestions.filter(question => phase === null || question.phase == null || question.phase === phase) }, progress }
}

export function toPublicQuestions(
  questions: Array<{
    id: string
    statement: string
    order: number
    imageUrl: string | null
    options: Array<{ id: string; text: string }>
  }>,
): PublicQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    statement: question.statement,
    order: question.order,
    imageUrl: question.imageUrl,
    options: question.options.map((option, index) => ({
      id: option.id,
      text: option.text,
      order: index + 1,
    })),
  }))
}

export function gradeAnswers(
  questions: Array<{ id: string; options: Array<{ id: string; isCorrect: boolean }> }>,
  answers: Array<{ questionId: string; optionId: string }>,
) {
  if (answers.length !== questions.length) {
    throw new QuizError('INVALID_ANSWERS', 'Envie uma resposta para cada pergunta do quiz.')
  }
  const seen = new Set<string>()
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const graded: Array<{ questionId: string; optionId: string; isCorrect: boolean }> = []

  for (const answer of answers) {
    if (seen.has(answer.questionId)) throw new QuizError('INVALID_ANSWERS', 'Há perguntas duplicadas nas respostas.')
    seen.add(answer.questionId)
    const question = questionById.get(answer.questionId)
    if (!question) throw new QuizError('INVALID_ANSWERS', 'Uma ou mais perguntas não pertencem a este módulo.')
    const option = question.options.find((item) => item.id === answer.optionId)
    if (!option) throw new QuizError('INVALID_ANSWERS', 'Uma ou mais alternativas são inválidas.')
    graded.push({ questionId: answer.questionId, optionId: answer.optionId, isCorrect: option.isCorrect })
  }

  if (seen.size !== questions.length) {
    throw new QuizError('INVALID_ANSWERS', 'Envie uma resposta para cada pergunta do quiz.')
  }

  const correctCount = graded.filter((item) => item.isCorrect).length
  return { graded, correctCount, totalCount: questions.length, score: correctCount / questions.length }
}

async function latestAttempt(progressId: string, phase: 'PRE' | 'POST', db: Prisma.TransactionClient = getPrisma()) {
  return db.quizAttempt.findFirst({
    where: { progressId, phase, finishedAt: { not: null }, supersededAt: null },
    orderBy: { submittedAt: phase === 'PRE' ? 'asc' : 'desc' },
    select: {
      id: true,
      correctCount: true,
      totalCount: true,
      score: true,
      isApproved: true,
      minimumCorrect: true,
      pointsAwarded: true,
      finishedAt: true,
      submittedAt: true,
    },
  })
}

async function openPostAttempt(progressId: string, db: Prisma.TransactionClient = getPrisma(), attemptId?: string) {
  return db.quizAttempt.findFirst({
    where: { progressId, phase: 'POST', finishedAt: null, supersededAt: null, ...(attemptId ? { id: attemptId } : {}) },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      correctCount: true,
      totalCount: true,
      answers: { select: { questionId: true, optionId: true, isCorrect: true } },
    },
  })
}

/**
 * Consulta a aprovação do pós-teste no servidor para o usuário e módulo informados,
 * sem confiar em notas ou aprovações enviadas pelo cliente.
 */
export async function getQuizCompletionStatus(context: QuizCompletionContext): Promise<QuizCompletionStatus> {
  const progress = await getPrisma().moduleProgress.findUnique({
    where: { userId_moduleId: { userId: context.userId, moduleId: context.moduleId } },
    select: { id: true },
  })
  if (!progress) return 'not_approved'
  const threshold = await configuration(getPrisma(), 'quiz_pass_score', 'LIMIT')
  const approved = await getPrisma().quizAttempt.findFirst({
    where: { progressId: progress.id, phase: 'POST', supersededAt: null, score: { gte: threshold.isActive ? threshold.value! / 100 : 0 }, totalCount: { gt: 0 }, finishedAt: { not: null } },
    select: { id: true },
  })
  return approved ? 'approved' : 'not_approved'
}

export async function getLearnState(userId: string, moduleId: string): Promise<LearnState> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId, getPrisma(), null)
  const preCount = module.quizQuestions.filter(question => question.phase == null || question.phase === 'PRE').length
  const totalCount = module.quizQuestions.filter(question => question.phase == null || question.phase === 'POST').length
  const pre = await latestAttempt(progress.id, 'PRE')
  const post = await latestAttempt(progress.id, 'POST')
  const minCorrect = await minimumCorrect(getPrisma(), post?.totalCount ?? (totalCount || 1))

  const preDone = Boolean(progress.preTestCompletedAt)
  const trainingDone = Boolean(progress.trainingCompletedAt)
  const awards = await moduleAwards(getPrisma(), userId, moduleId)
  const postApproved = Boolean(post && post.correctCount >= minCorrect)

  return {
    moduleId,
    preTest: {
      status: preDone ? 'completed' : 'available',
      correctCount: pre?.correctCount ?? null,
      totalCount: pre?.totalCount ?? (preCount || null),
      pointsAwarded: pre?.pointsAwarded ?? 0,
    },
    training: {
      status: !preDone ? 'locked' : trainingDone ? 'completed' : 'available',
      pointsAwarded: progress.trainingPointsAwarded,
    },
    postTest: {
      status: !trainingDone ? 'locked' : postApproved ? 'completed' : 'available',
      correctCount: post?.correctCount ?? null,
      totalCount: post?.totalCount ?? (totalCount || null),
      isApproved: post ? postApproved : null,
      pointsAwarded: post?.pointsAwarded ?? 0,
      minimumCorrect: minCorrect,
    },
    moduleCompletion: awards.moduleCompletion,
    totalPoints: awards.moduleCompletion.pointsAwarded + awards.quizPoints,
  }
}

export async function getPreTestQuestions(userId: string, moduleId: string) {
  const { module } = await requireAccessibleModule(userId, moduleId, getPrisma(), 'PRE')
  if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')
  return {
    moduleId,
    phase: 'PRE' as const,
    totalCount: module.quizQuestions.length,
    questions: toPublicQuestions(module.quizQuestions),
  }
}

export async function submitPreTest(userId: string, moduleId: string, input: SubmitPreTest): Promise<PreTestResult> {
  const attempt = await learningTransaction(async (tx) => {
    const { module, progress } = await requireAccessibleModule(userId, moduleId, tx, 'PRE')
    if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')
    const { graded, correctCount, totalCount, score } = gradeAnswers(module.quizQuestions, input.answers)
    const fresh = await tx.moduleProgress.findUniqueOrThrow({ where: { id: progress.id } })
    if (fresh.preTestCompletedAt) throw new QuizError('ANSWER_ALREADY_SUBMITTED', 'O pré-teste inicial já foi registrado.')
    const created = await tx.quizAttempt.create({
      data: {
        progressId: progress.id,
        phase: 'PRE',
        correctCount,
        totalCount,
        score,
        isApproved: true,
        pointsAwarded: 0,
        finishedAt: new Date(),
        answers: {
          create: graded.map((item) => ({
            questionId: item.questionId,
            optionId: item.optionId,
            isCorrect: item.isCorrect,
          })),
        },
      },
      select: { id: true, correctCount: true, totalCount: true, pointsAwarded: true },
    })
    await tx.moduleProgress.update({
      where: { id: progress.id },
      data: { preTestCompletedAt: progress.preTestCompletedAt ?? new Date() },
    })
    return created
  })

  return {
    moduleId,
    attemptId: attempt.id,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    pointsAwarded: attempt.pointsAwarded,
    title: 'Ótimo começo!',
    message: 'Agora vem o treinamento. No fim, um novo quiz mostra o quanto você aprendeu.',
    hint: 'As respostas certas aparecem só no pós-teste.',
  }
}

export async function getPreTestResult(userId: string, moduleId: string): Promise<PreTestResult> {
  const { progress } = await requireAccessibleModule(userId, moduleId)
  const attempt = await latestAttempt(progress.id, 'PRE')
  if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Pré-teste ainda não foi concluído.')
  return {
    moduleId,
    attemptId: attempt.id,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    pointsAwarded: attempt.pointsAwarded,
    title: 'Ótimo começo!',
    message: 'Agora vem o treinamento. No fim, um novo quiz mostra o quanto você aprendeu.',
    hint: 'As respostas certas aparecem só no pós-teste.',
  }
}

export async function getTraining(userId: string, moduleId: string) {
  const { progress } = await requireAccessibleModule(userId, moduleId)
  if (!progress.preTestCompletedAt) throw new QuizError('PRE_TEST_REQUIRED', 'Conclua o pré-teste antes do treinamento.')
  const steps = await getPrisma().trainingStep.findMany({
    where: { moduleId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      kind: true,
      order: true,
      durationMinutes: true,
      introText: true,
      cards: { orderBy: { order: 'asc' }, select: { id: true, title: true, description: true, order: true } },
    },
  })
  return {
    moduleId,
    completed: Boolean(progress.trainingCompletedAt),
    pointsAwarded: progress.trainingPointsAwarded,
    steps,
  }
}

export async function completeTraining(userId: string, moduleId: string) {
  const { progress, module } = await requireAccessibleModule(userId, moduleId)
  if (!progress.preTestCompletedAt) throw new QuizError('PRE_TEST_REQUIRED', 'Conclua o pré-teste antes do treinamento.')
  return learningTransaction(async tx => {
    const fresh = await tx.moduleProgress.findUniqueOrThrow({ where: { id: progress.id } })
    const rule = await configuration(tx, 'training_completion', 'RULE')
    const rulePoints = rule.isActive ? rule.value! : 0
    const now = new Date()
    if (!fresh.trainingCompletedAt) {
      await tx.moduleProgress.update({
        where: { id: progress.id },
        data: { trainingCompletedAt: now, trainingPointsAwarded: rulePoints },
      })
      await queueTrainingAward(tx, userId, moduleId, module.trailId)
    }
    await releasePendingModules(tx, userId, now)
    const award = await tx.learningAward.findUnique({
      where: { userId_ruleKey_sourceId: { userId, ruleKey: 'training_completion', sourceId: moduleId } },
      select: { points: true, grantedAt: true },
    })
    return {
      moduleId,
      completed: true as const,
      pointsAwarded: award?.grantedAt ? award.points : 0,
    }
  })
}

export async function getPostTestQuestions(userId: string, moduleId: string) {
  return learningTransaction(async tx => {
    const { module, progress } = await requireAccessibleModule(userId, moduleId, tx)
    if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
    if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')

    let attempt = await openPostAttempt(progress.id, tx)
    if (!attempt) {
      const previous = await latestAttempt(progress.id, 'POST', tx)
      await assertRetry(tx, previous?.finishedAt ?? null, new Date())
      attempt = await tx.quizAttempt.create({
        data: {
          progressId: progress.id,
          phase: 'POST',
          correctCount: 0,
          totalCount: module.quizQuestions.length,
          score: 0,
          isApproved: false,
          pointsAwarded: 0,
          finishedAt: null,
        },
        select: { id: true, correctCount: true, totalCount: true, answers: true },
      })
    }

    return {
      moduleId,
      phase: 'POST' as const,
      attemptId: attempt.id,
      answeredCount: attempt.answers.length,
      totalCount: module.quizQuestions.length,
      questions: toPublicQuestions(module.quizQuestions),
    }
  })
}

export async function submitPostAnswer(userId: string, moduleId: string, input: SubmitPostAnswer): Promise<PostAnswerFeedback> {
  return learningTransaction(async tx => {
    const { module, progress } = await requireAccessibleModule(userId, moduleId, tx)
    if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
    const question = module.quizQuestions.find((item) => item.id === input.questionId)
    if (!question) throw new QuizError('INVALID_ANSWERS', 'Pergunta não encontrada neste módulo.')
    const selected = question.options.find((item) => item.id === input.optionId)
    if (!selected) throw new QuizError('INVALID_ANSWERS', 'Alternativa inválida para esta pergunta.')
    const correct = question.options.find((item) => item.isCorrect)
    if (!correct) throw new QuizError('QUIZ_EMPTY', 'A pergunta não possui alternativa correta configurada.')

    const attempt = await openPostAttempt(progress.id, tx, input.attemptId)
    if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Tentativa aberta não encontrada para este usuário e módulo.')

    if (attempt.answers.some((item) => item.questionId === input.questionId)) {
      throw new QuizError('ANSWER_ALREADY_SUBMITTED', 'Esta pergunta já foi respondida nesta tentativa.')
    }

    const isCorrect = selected.isCorrect
    const created = await tx.quizAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: input.questionId,
        optionId: input.optionId,
        isCorrect,
      },
      select: { id: true },
    })
    void created

    return {
      attemptId: attempt.id,
      questionId: input.questionId,
      selectedOptionId: input.optionId,
      correctOptionId: correct.id,
      isCorrect,
      feedbackKind: isCorrect ? 'correct' : 'incorrect',
      feedback: {
        title: question.explanationTitle,
        body: question.explanationBody,
      },
      answeredCount: attempt.answers.length + 1,
      totalCount: module.quizQuestions.length,
    }
  })
}

export async function finishPostTest(userId: string, moduleId: string, input: FinishPostTest): Promise<PostTestResult> {
  return learningTransaction(async tx => {
    const { module, progress } = await requireAccessibleModule(userId, moduleId, tx)
    if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
    if (!module.quizQuestions.length) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')
    const attempt = await openPostAttempt(progress.id, tx, input.attemptId)
    if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Inicie o pós-teste antes de finalizar.')
    if (attempt.answers.length !== module.quizQuestions.length) {
      throw new QuizError('ATTEMPT_INCOMPLETE', 'Responda todas as perguntas antes de finalizar o pós-teste.')
    }

    const correctCount = attempt.answers.filter((item) => item.isCorrect).length
    const totalCount = module.quizQuestions.length
    const score = correctCount / totalCount
    const minCorrect = await minimumCorrect(tx, totalCount)
    const isApproved = correctCount >= minCorrect
    const pre = await latestAttempt(progress.id, 'PRE', tx)

    let pointsAwarded = 0
    const now = new Date()
    if (isApproved) pointsAwarded += await awardOnce(tx, { userId, ruleKey: 'module_quiz', sourceId: moduleId, moduleId, trailId: module.trailId }, now)
    if (pre && pre.totalCount > 0 && correctCount * pre.totalCount > pre.correctCount * totalCount) {
      const limit = await configuration(tx, 'post_test_improvement_awards', 'LIMIT')
      const count = await tx.learningAward.count({ where: { userId, ruleKey: 'post_test_improvement' } })
      if (!limit.isActive || count < limit.value!) pointsAwarded += await awardOnce(tx, { userId, ruleKey: 'post_test_improvement', sourceId: 'once', moduleId, trailId: module.trailId }, now)
    }
    const finished = await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        correctCount,
        totalCount,
        score,
        isApproved,
        minimumCorrect: minCorrect,
        pointsAwarded,
        finishedAt: new Date(),
      },
      select: { id: true, correctCount: true, totalCount: true, isApproved: true, pointsAwarded: true },
    })

    const before = {
      correctCount: pre?.correctCount ?? 0,
      totalCount: pre?.totalCount ?? totalCount,
    }
    const after = { correctCount: finished.correctCount, totalCount: finished.totalCount }
    const prePoints = pre?.pointsAwarded ?? 0
    const trainingPoints = progress.trainingPointsAwarded
    const awards = await moduleAwards(tx, userId, moduleId)
    const totalPoints = awards.moduleCompletion.pointsAwarded + awards.quizPoints

    return {
      moduleId,
      attemptId: finished.id,
      correctCount: finished.correctCount,
      totalCount: finished.totalCount,
      isApproved: finished.isApproved,
      minimumCorrect: minCorrect,
      pointsAwarded: finished.pointsAwarded,
      totalPoints,
      moduleCompletion: awards.moduleCompletion,
      before,
      after,
      title: finished.isApproved ? 'Você aprendeu!' : 'Quase lá!',
      message: finished.isApproved
        ? `${finished.correctCount} de ${finished.totalCount} no pós-teste`
        : `${finished.correctCount} de ${finished.totalCount} no pós-teste. Para concluir, acerte ${minCorrect}.`,
      reviewHint: finished.isApproved ? null : 'Revise o treinamento e as explicações das respostas antes de tentar novamente.',
      pointsBreakdown: {
        preTest: prePoints,
        training: trainingPoints,
        postTest: awards.quizPoints,
      },
    }
  })
}

export async function getPostTestResult(userId: string, moduleId: string): Promise<PostTestResult> {
  const { progress } = await requireAccessibleModule(userId, moduleId)
  const attempt = await latestAttempt(progress.id, 'POST')
  if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Pós-teste ainda não foi concluído.')
  const totalCount = attempt.totalCount
  const awards = await moduleAwards(getPrisma(), userId, moduleId)
  const minCorrect = attempt.minimumCorrect ?? await minimumCorrect(getPrisma(), totalCount)
  const pre = await latestAttempt(progress.id, 'PRE')
  const prePoints = pre?.pointsAwarded ?? 0
  const trainingPoints = progress.trainingPointsAwarded
  return {
    moduleId,
    attemptId: attempt.id,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    isApproved: attempt.isApproved,
    minimumCorrect: minCorrect,
    pointsAwarded: attempt.pointsAwarded,
    moduleCompletion: awards.moduleCompletion,
    totalPoints: awards.moduleCompletion.pointsAwarded + awards.quizPoints,
    before: {
      correctCount: pre?.correctCount ?? 0,
      totalCount: pre?.totalCount ?? totalCount,
    },
    after: {
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
    },
    title: attempt.isApproved ? 'Você aprendeu!' : 'Quase lá!',
    message: attempt.isApproved
      ? `${attempt.correctCount} de ${attempt.totalCount} no pós-teste`
      : `${attempt.correctCount} de ${attempt.totalCount} no pós-teste. Para concluir, acerte ${minCorrect}.`,
    reviewHint: attempt.isApproved ? null : 'Revise o treinamento e as explicações das respostas antes de tentar novamente.',
    pointsBreakdown: {
      preTest: prePoints,
      training: trainingPoints,
      postTest: awards.quizPoints,
    },
  }
}
