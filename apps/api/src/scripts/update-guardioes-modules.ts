import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client.js'
import { guardioesModules } from './guardioes-modules.js'

// O conteúdo faz parte da identidade: revisões não reescrevem respostas históricas.
export function questionId(moduleId: string, question: unknown): string {
  const hash = createHash('sha256').update(moduleId + JSON.stringify(question)).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

export async function updateGuardioesModules(tx: Prisma.TransactionClient) {
  // A API libera relatos pelo primeiro módulo da primeira trilha publicada.
  const existing = await tx.trail.findFirst({
    where: { publicationStatus: 'PUBLISHED' }, orderBy: { order: 'asc' },
    include: { modules: { orderBy: { order: 'asc' } } },
  })
  if (existing && existing.modules.length > 7) {
    throw new Error('A primeira trilha tem mais de sete módulos. Reorganize-a antes de aplicar este conteúdo; nenhum módulo foi removido.')
  }
  const trailData = { title: 'Guardiões da Energia', description: 'Sete módulos para reconhecer riscos e comunicar com segurança.' }
  const trail = existing
    ? await tx.trail.update({ where: { id: existing.id }, data: trailData })
    : await tx.trail.create({ data: { ...trailData, order: ((await tx.trail.aggregate({ _max: { order: true } }))._max.order ?? 0) + 1, publicationStatus: 'PUBLISHED' } })
  const trailId = trail.id

  let revisedQuizzes = 0
  // Libera os índices de ordenação antes de normalizar a sequência para 1–7.
  if (existing?.modules.length) {
    const temporaryOrder = Math.max(...existing.modules.map(module => module.order)) + 7
    for (const [index, module] of existing.modules.entries()) {
      await tx.trailModule.update({ where: { id: module.id }, data: { order: temporaryOrder + index } })
    }
  }
  for (const [index, source] of guardioesModules.entries()) {
    const moduleId = existing?.modules[index]?.id ?? randomUUID()
    const { questions, steps, ...content } = source
    const moduleData = { ...content, order: index + 1, publicationStatus: 'PUBLISHED' as const, isActive: true, requiresQuiz: true }
    await tx.trailModule.upsert({
      where: { id: moduleId },
      create: { ...moduleData, id: moduleId, trailId },
      update: moduleData,
    })

    const current = await tx.quizQuestion.findMany({ where: { moduleId, isActive: true }, orderBy: { order: 'asc' }, select: { id: true } })
    const ids = questions.map(question => questionId(moduleId, question))
    if (JSON.stringify(current.map(question => question.id)) !== JSON.stringify(ids)) {
      // Arquiva perguntas antigas, mantendo opções e respostas já registradas.
      const max = await tx.quizQuestion.aggregate({ where: { moduleId }, _max: { order: true } })
      await tx.quizQuestion.updateMany({ where: { moduleId }, data: { isActive: false } })
      await tx.quizQuestion.updateMany({ where: { moduleId, order: { lte: 15 } }, data: { order: { increment: (max._max.order ?? 0) + 15 } } })
      const stored = await tx.quizQuestion.findMany({ where: { moduleId, id: { in: ids } }, select: { id: true } })
      const storedIds = new Set(stored.map(question => question.id))
      const additions = questions.flatMap((question, position) => storedIds.has(ids[position]!) ? [] : [{ question, id: ids[position]!, order: position + 1 }])
      if (additions.length) {
        await tx.quizQuestion.createMany({ data: additions.map(({ question, id, order }) => ({
          id, moduleId, order, phase: question.phase, statement: question.statement,
          explanationTitle: question.explanationTitle, explanationBody: question.explanationBody,
        })) })
        await tx.quizOption.createMany({ data: additions.flatMap(({ question, id }) => question.options.map(option => ({ ...option, questionId: id }))) })
      }
      for (const [position, question] of questions.entries()) {
        if (!storedIds.has(ids[position]!)) continue
        await tx.quizQuestion.update({ where: { id: ids[position]! }, data: { isActive: true, order: position + 1 } })
      }
      // Uma tentativa aberta sobre o banco anterior não pode misturar versões.
      await tx.quizAttempt.updateMany({ where: { progress: { moduleId }, phase: 'POST', finishedAt: null, supersededAt: null }, data: { supersededAt: new Date() } })
      revisedQuizzes++
    }

    await tx.trainingStep.deleteMany({ where: { moduleId } })
    const training = steps.map((step, index) => ({ step, id: randomUUID(), order: index + 1 }))
    await tx.trainingStep.createMany({ data: training.map(({ step, id, order }) => ({ id, moduleId, title: step.title, kind: step.kind, introText: step.introText, order })) })
    await tx.trainingCard.createMany({ data: training.flatMap(({ step, id }) => step.cards.map((card, index) => ({ ...card, stepId: id, order: index + 1 }))) })
  }
  return { trailId, modules: 7, preQuestions: 35, postQuestions: 70, revisedQuizzes }
}
