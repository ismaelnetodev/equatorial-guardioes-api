import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { getPrisma } from '../../lib/prisma.js'
import type {
  LearnState,
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

const PRE_TEST_POINTS = 5
const TRAINING_POINTS = 10
const POST_TEST_MAX_POINTS = 20
const DEFAULT_MINIMUM_SCORE = 0.7

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

async function requireAccessibleModule(userId: string, moduleId: string) {
  const module = await getPrisma().trailModule.findUnique({
    where: { id: moduleId, ...publishedModuleWhere, trail: publishedTrailWhere },
    select: {
      id: true,
      trailId: true,
      isActive: true,
      requiresQuiz: true,
      quizMinimumScore: true,
      quizQuestions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
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

  const trail = await getPrisma().trail.findUnique({
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

  const progress = await getPrisma().moduleProgress.findUnique({
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

  return { module, progress }
}

function toPublicQuestions(
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

function minimumCorrect(totalCount: number, quizMinimumScore: number | null): number {
  const ratio = quizMinimumScore ?? DEFAULT_MINIMUM_SCORE
  return Math.max(1, Math.ceil(totalCount * ratio))
}

function postPoints(correctCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  return Math.round((correctCount / totalCount) * POST_TEST_MAX_POINTS)
}

function gradeAnswers(
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

async function latestAttempt(progressId: string, phase: 'PRE' | 'POST') {
  return getPrisma().quizAttempt.findFirst({
    where: { progressId, phase, finishedAt: { not: null } },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      correctCount: true,
      totalCount: true,
      score: true,
      isApproved: true,
      pointsAwarded: true,
      finishedAt: true,
      submittedAt: true,
    },
  })
}

async function openPostAttempt(progressId: string) {
  return getPrisma().quizAttempt.findFirst({
    where: { progressId, phase: 'POST', finishedAt: null },
    orderBy: { submittedAt: 'desc' },
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
  const approved = await getPrisma().quizAttempt.findFirst({
    where: { progressId: progress.id, phase: 'POST', isApproved: true, finishedAt: { not: null } },
    select: { id: true },
  })
  return approved ? 'approved' : 'not_approved'
}

export async function getLearnState(userId: string, moduleId: string): Promise<LearnState> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  const totalCount = module.quizQuestions.length
  const minCorrect = minimumCorrect(totalCount || 1, module.quizMinimumScore)
  const pre = await latestAttempt(progress.id, 'PRE')
  const post = await latestAttempt(progress.id, 'POST')

  const preDone = Boolean(progress.preTestCompletedAt)
  const trainingDone = Boolean(progress.trainingCompletedAt)
  const postApproved = Boolean(post?.isApproved)

  return {
    moduleId,
    preTest: {
      status: preDone ? 'completed' : 'available',
      correctCount: pre?.correctCount ?? null,
      totalCount: pre?.totalCount ?? (totalCount || null),
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
      isApproved: post ? post.isApproved : null,
      pointsAwarded: post?.pointsAwarded ?? 0,
      minimumCorrect: minCorrect,
    },
    totalPoints: (pre?.pointsAwarded ?? 0) + progress.trainingPointsAwarded + (post?.pointsAwarded ?? 0),
  }
}

export async function getPreTestQuestions(userId: string, moduleId: string) {
  const { module } = await requireAccessibleModule(userId, moduleId)
  if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')
  return {
    moduleId,
    phase: 'PRE' as const,
    totalCount: module.quizQuestions.length,
    questions: toPublicQuestions(module.quizQuestions),
  }
}

export async function submitPreTest(userId: string, moduleId: string, input: SubmitPreTest): Promise<PreTestResult> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')
  const { graded, correctCount, totalCount, score } = gradeAnswers(module.quizQuestions, input.answers)

  const attempt = await getPrisma().$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        progressId: progress.id,
        phase: 'PRE',
        correctCount,
        totalCount,
        score,
        isApproved: true,
        pointsAwarded: PRE_TEST_POINTS,
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
    message: 'Agora vem o treinamento. No fim, você refaz as perguntas e vê o quanto aprendeu.',
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
    message: 'Agora vem o treinamento. No fim, você refaz as perguntas e vê o quanto aprendeu.',
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
  const { progress } = await requireAccessibleModule(userId, moduleId)
  if (!progress.preTestCompletedAt) throw new QuizError('PRE_TEST_REQUIRED', 'Conclua o pré-teste antes do treinamento.')
  const updated = await getPrisma().moduleProgress.update({
    where: { id: progress.id },
    data: {
      trainingCompletedAt: progress.trainingCompletedAt ?? new Date(),
      trainingPointsAwarded: progress.trainingCompletedAt ? progress.trainingPointsAwarded : TRAINING_POINTS,
    },
    select: { trainingPointsAwarded: true },
  })
  return { moduleId, completed: true as const, pointsAwarded: updated.trainingPointsAwarded }
}

export async function getPostTestQuestions(userId: string, moduleId: string) {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
  if (module.quizQuestions.length === 0) throw new QuizError('QUIZ_EMPTY', 'Este módulo ainda não possui perguntas de quiz.')

  let attempt = await openPostAttempt(progress.id)
  if (!attempt) {
    attempt = await getPrisma().quizAttempt.create({
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
}

export async function submitPostAnswer(userId: string, moduleId: string, input: SubmitPostAnswer): Promise<PostAnswerFeedback> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
  const question = module.quizQuestions.find((item) => item.id === input.questionId)
  if (!question) throw new QuizError('INVALID_ANSWERS', 'Pergunta não encontrada neste módulo.')
  const selected = question.options.find((item) => item.id === input.optionId)
  if (!selected) throw new QuizError('INVALID_ANSWERS', 'Alternativa inválida para esta pergunta.')
  const correct = question.options.find((item) => item.isCorrect)
  if (!correct) throw new QuizError('QUIZ_EMPTY', 'A pergunta não possui alternativa correta configurada.')

  let attempt = await openPostAttempt(progress.id)
  if (!attempt) {
    attempt = await getPrisma().quizAttempt.create({
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

  if (attempt.answers.some((item) => item.questionId === input.questionId)) {
    throw new QuizError('ANSWER_ALREADY_SUBMITTED', 'Esta pergunta já foi respondida nesta tentativa.')
  }

  const isCorrect = selected.isCorrect
  const created = await getPrisma().quizAnswer.create({
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
}

export async function finishPostTest(userId: string, moduleId: string): Promise<PostTestResult> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  if (!progress.trainingCompletedAt) throw new QuizError('TRAINING_REQUIRED', 'Conclua o treinamento antes do pós-teste.')
  const attempt = await openPostAttempt(progress.id)
  if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Inicie o pós-teste antes de finalizar.')
  if (attempt.answers.length !== module.quizQuestions.length) {
    throw new QuizError('ATTEMPT_INCOMPLETE', 'Responda todas as perguntas antes de finalizar o pós-teste.')
  }

  const correctCount = attempt.answers.filter((item) => item.isCorrect).length
  const totalCount = module.quizQuestions.length
  const score = correctCount / totalCount
  const minCorrect = minimumCorrect(totalCount, module.quizMinimumScore)
  const isApproved = correctCount >= minCorrect
  const pointsAwarded = postPoints(correctCount, totalCount)
  const pre = await latestAttempt(progress.id, 'PRE')

  const finished = await getPrisma().quizAttempt.update({
    where: { id: attempt.id },
    data: {
      correctCount,
      totalCount,
      score,
      isApproved,
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
  const totalPoints = prePoints + trainingPoints + finished.pointsAwarded

  return {
    moduleId,
    attemptId: finished.id,
    correctCount: finished.correctCount,
    totalCount: finished.totalCount,
    isApproved: finished.isApproved,
    minimumCorrect: minCorrect,
    pointsAwarded: finished.pointsAwarded,
    totalPoints,
    before,
    after,
    title: finished.isApproved ? 'Você aprendeu!' : 'Quase lá!',
    message: finished.isApproved
      ? `${finished.correctCount} de ${finished.totalCount} no pós-teste`
      : `${finished.correctCount} de ${finished.totalCount} no pós-teste. Para concluir, acerte ${minCorrect}.`,
    reviewHint: finished.isApproved ? null : 'Revise a etapa “O que NÃO fazer”. É onde mais gente erra.',
    pointsBreakdown: {
      preTest: prePoints,
      training: trainingPoints,
      postTest: finished.pointsAwarded,
    },
  }
}

export async function getPostTestResult(userId: string, moduleId: string): Promise<PostTestResult> {
  const { module, progress } = await requireAccessibleModule(userId, moduleId)
  const attempt = await latestAttempt(progress.id, 'POST')
  if (!attempt) throw new QuizError('ATTEMPT_NOT_FOUND', 'Pós-teste ainda não foi concluído.')
  const totalCount = attempt.totalCount
  const minCorrect = minimumCorrect(totalCount, module.quizMinimumScore)
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
    totalPoints: prePoints + trainingPoints + attempt.pointsAwarded,
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
    reviewHint: attempt.isApproved ? null : 'Revise a etapa “O que NÃO fazer”. É onde mais gente erra.',
    pointsBreakdown: {
      preTest: prePoints,
      training: trainingPoints,
      postTest: attempt.pointsAwarded,
    },
  }
}
