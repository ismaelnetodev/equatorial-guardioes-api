import { describe, expect, it } from 'vitest'
import { guardioesModules } from './guardioes-modules.js'
import { questionId } from './update-guardioes-modules.js'

describe('conteúdo dos sete módulos', () => {
  it('contém 35 perguntas diagnósticas e 70 finais, com uma resposta correta por item', () => {
    expect(guardioesModules).toHaveLength(7)
    for (const module of guardioesModules) {
      expect(module.questions.filter(question => question.phase === 'PRE')).toHaveLength(5)
      expect(module.questions.filter(question => question.phase === 'POST')).toHaveLength(10)
      expect(new Set(module.questions.map(question => question.statement)).size).toBe(15)
      for (const question of module.questions) {
        expect(question.options).toHaveLength(4)
        expect(question.options.filter(option => option.isCorrect)).toHaveLength(1)
        expect(question.explanationBody.length).toBeGreaterThan(10)
      }
    }
  })

  it('mantém as quatro etapas na ordem solicitada e três lembretes no fechamento', () => {
    for (const module of guardioesModules) {
      expect(module.steps.map(step => step.title)).toEqual(['Reconhecer', 'O que fazer', 'O que NÃO fazer', 'Como comunicar', '3 pontos para lembrar'])
      expect(module.steps.map(step => step.kind)).toEqual(['RECOGNIZE', 'INFO', 'DO_NOT', 'INFO', 'INFO'])
      expect(module.steps[4].cards).toHaveLength(3)
      expect(module.description.length).toBeGreaterThan(20)
      expect(module.content).toContain(module.steps[0].introText)
      expect(module.content).toContain(module.steps[4].cards[2].description)
    }
    expect(guardioesModules[0].description).toMatch(/^Aplicar/)
    expect(guardioesModules[0].steps[0].introText).toMatch(/^Um risco/)
  })

  it('gera identidades estáveis e uma nova identidade quando o conteúdo muda', () => {
    const ids = guardioesModules.flatMap((module, index) => module.questions.map(question => questionId(String(index), question)))
    expect(new Set(ids).size).toBe(105)
    const question = guardioesModules[0].questions[0]
    expect(questionId('module', question)).toBe(questionId('module', { ...question }))
    expect(questionId('module', question)).not.toBe(questionId('module', { ...question, statement: 'Revisão' }))
  })
})
