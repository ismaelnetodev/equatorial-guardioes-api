import { getPrisma } from '../../lib/prisma.js'
import { publishedModuleWhere, publishedTrailWhere } from '../../lib/content-visibility.js'
import { configuration, LearningError, learningTransaction } from './learning-rules.service.js'
import { QuizError } from './quiz.service.js'

const certificateView = (row: { id: string; holderName: string; trailTitle: string; issuedAt: Date }) => ({ id: row.id, holderName: row.holderName, trailTitle: row.trailTitle, issuedAt: row.issuedAt.toISOString(), badge: 'Guardião da Energia' })

export async function getTrailCompletion(userId: string, trailId: string) {
  const db = getPrisma()
  const trail = await db.trail.findUnique({ where: { id: trailId, ...publishedTrailWhere }, select: {
    id: true, title: true, modules: { where: publishedModuleWhere, select: { id: true, progressRecords: { where: { userId }, select: { completedAt: true } }, _count: { select: { quizQuestions: { where: { isActive: true, OR: [{ phase: null }, { phase: 'POST' }] } } } } } },
  } })
  if (!trail) throw new QuizError('MODULE_NOT_FOUND', 'Trilha não encontrada.')
  const completed = trail.modules.filter(module => module.progressRecords[0]?.completedAt)
  const allCompleted = trail.modules.length > 0 && completed.length === trail.modules.length
  const delay = await configuration(db, 'final_exam_delay', 'LIMIT')
  const retry = await configuration(db, 'quiz_retry_interval', 'LIMIT')
  const threshold = await configuration(db, 'quiz_pass_score', 'LIMIT')
  const reward = await db.programConfiguration.findUnique({ where: { key: 'certificate' } })
  const [previous, passed, certificate] = await Promise.all([
    db.finalExamAttempt.findFirst({ where: { userId, trailId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }),
    db.finalExamAttempt.findFirst({ where: { userId, trailId, isApproved: true }, orderBy: { submittedAt: 'desc' } }),
    db.trailCertificate.findUnique({ where: { userId_trailId: { userId, trailId } } }),
  ])
  const lastCompletion = completed.length ? Math.max(...completed.map(module => module.progressRecords[0]!.completedAt!.getTime())) : 0
  const availableAt = allCompleted ? new Date(lastCompletion + (delay.isActive ? delay.value! * 3600000 : 0)) : null
  const retryAt = previous && retry.isActive ? new Date(previous.submittedAt.getTime() + retry.value! * 1000) : null
  const totalQuestions = trail.modules.reduce((sum, module) => sum + module._count.quizQuestions, 0)
  const now = Date.now()
  const status: 'APPROVED' | 'MODULES_PENDING' | 'QUESTIONS_PENDING' | 'WAITING' | 'RETRY_WAITING' | 'AVAILABLE' = passed ? 'APPROVED' : !allCompleted ? 'MODULES_PENDING' : !totalQuestions ? 'QUESTIONS_PENDING' : availableAt!.getTime() > now ? 'WAITING' : retryAt && retryAt.getTime() > now ? 'RETRY_WAITING' : 'AVAILABLE'
  return {
    trailId, title: trail.title, completedModules: completed.length, totalModules: trail.modules.length,
    finalExam: { status, availableAt: availableAt?.toISOString() ?? null, retryAt: retryAt?.toISOString() ?? null, totalQuestions, minimumPercent: threshold.isActive ? threshold.value! : 0, lastResult: previous ? { correctCount: previous.correctCount, totalCount: previous.totalCount, minimumCorrect: previous.minimumCorrect, isApproved: previous.isApproved, pointsAwarded: previous.pointsAwarded } : null },
    certificate: certificate ? certificateView(certificate) : null,
    canIssueCertificate: allCompleted && Boolean(passed) && Boolean(reward?.isActive),
  }
}

export async function issueTrailCertificate(userId: string, trailId: string) {
  return learningTransaction(async tx => {
    const existing = await tx.trailCertificate.findUnique({ where: { userId_trailId: { userId, trailId } } })
    if (existing) return certificateView(existing)
    const trail = await tx.trail.findUnique({ where: { id: trailId, ...publishedTrailWhere }, select: { title: true, modules: { where: publishedModuleWhere, select: { progressRecords: { where: { userId }, select: { completedAt: true } } } } } })
    if (!trail) throw new QuizError('MODULE_NOT_FOUND', 'Trilha não encontrada.')
    const passed = await tx.finalExamAttempt.findFirst({ where: { userId, trailId, isApproved: true } })
    const reward = await tx.programConfiguration.findUnique({ where: { key: 'certificate' } })
    if (!trail.modules.length || trail.modules.some(module => !module.progressRecords[0]?.completedAt) || !passed || !reward?.isActive) throw new LearningError('FINAL_EXAM_LOCKED', 'Conclua todos os módulos e seja aprovado na prova final para receber o certificado. A emissão também deve estar ativa no programa.')
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } })
    return certificateView(await tx.trailCertificate.create({ data: { userId, trailId, holderName: user.name, trailTitle: trail.title } }))
  })
}
