import { describe, expect, it } from 'vitest'
import { estimateReadingSeconds } from './reading-time.js'

describe('Estimativa de leitura', () => {
  it('calcula segundos sem arredondar módulos curtos para minutos', () => {
    expect(estimateReadingSeconds({ content: 'palavra '.repeat(200) })).toBe(60)
    expect(estimateReadingSeconds({ content: 'palavra '.repeat(20) })).toBe(6)
    expect(estimateReadingSeconds({ content: 'Atenção à fiação!' })).toBe(1)
    expect(estimateReadingSeconds({ content: null })).toBe(0)
  })
  it('conta texto de links e ignora marcação e endereços', () => {
    expect(estimateReadingSeconds({ content: '<p>Olá</p> [mundo](https://example.com/a/b/c) ![imagem](https://example.com/img)' })).toBe(1)
  })
  it('usa apenas o treinamento estruturado que será lido nos módulos com quiz', () => {
    expect(estimateReadingSeconds({ requiresQuiz: true, content: 'ignorado '.repeat(1000), trainingSteps: [{ title: 'Observe', introText: 'de longe', cards: [{ title: 'Cuidado', description: 'com os fios' }] }] })).toBe(3)
    expect(estimateReadingSeconds({ requiresQuiz: false, content: 'texto '.repeat(10), trainingSteps: [] })).toBe(3)
  })
})
