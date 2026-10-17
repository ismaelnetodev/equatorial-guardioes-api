import { describe, expect, it } from 'vitest'
import { demoQuestions, demoTraining } from './demo-learning.js'

describe('conteúdo de aprendizagem da demonstração', () => {
  it('oferece três perguntas válidas para cada um dos sete módulos', () => {
    const scenarios = new Set<string>()
    for (let index = 0; index < 7; index++) {
      const questions = demoQuestions(index)
      expect(questions).toHaveLength(3)
      scenarios.add(questions[0]!.statement)
      for (const question of questions) {
        expect(question.options.create.filter(option => option.isCorrect)).toHaveLength(1)
        expect(new Set(question.options.create.map(option => option.text)).size).toBe(3)
        expect(question.explanationBody.length).toBeGreaterThan(0)
      }
    }
    expect(scenarios.size).toBe(7)
  })

  it('mantém objetivos e orientações do texto nos cartões sem incluir o rodapé', () => {
    const steps = demoTraining('Título\n\nIntrodução\n\n- Objetivo\n\nOrientação segura.\n\nReferência do local.\n\nConteúdo de demonstração para visualizar a trilha.')
    expect(steps[0]?.introText).toBe('Introdução')
    expect(steps[0]?.cards.create[0]?.description).toBe('- Objetivo')
    expect(steps[1]?.cards.create.map(card => card.description)).toEqual(['Orientação segura.', 'Referência do local.'])
  })
})
