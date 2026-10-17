// Conteúdo de demonstração baseado nos textos dos sete módulos da trilha.
const scenarios = [
  ['Qual é o papel do Guardião?', 'Observar com segurança e comunicar o que viu.', 'Consertar equipamentos danificados.', 'Intervir diretamente na rede.', 'A intervenção fica com profissionais autorizados.'],
  ['O que fazer ao observar um cabo caído?', 'Manter distância e informar o local.', 'Mover o cabo para liberar a passagem.', 'Tocar no cabo para verificar se oferece risco.', 'A aparência do fio não permite confirmar se ele está energizado.'],
  ['Como agir diante de um poste danificado?', 'Observar de longe e comunicar os sinais visíveis.', 'Subir para verificar o equipamento.', 'Abrir a caixa para procurar o defeito.', 'Descreva os danos observados; a avaliação cabe à equipe técnica.'],
  ['Como agir ao ver um objeto preso perto dos fios?', 'Informar a situação sem tentar retirar o objeto.', 'Usar uma vara para soltar o objeto.', 'Apoiar uma escada para alcançar os fios.', 'A retirada de objetos e a poda perto da rede exigem profissionais autorizados.'],
  ['Quando registrar uma ocorrência durante a chuva?', 'Quando estiver em um local seguro.', 'Depois de atravessar o alagamento para olhar melhor.', 'Ao chegar bem perto do equipamento danificado.', 'Sua segurança vem antes de qualquer registro.'],
  ['Qual descrição ajuda a equipe?', 'Cabo baixo próximo à praça, em frente ao ponto de ônibus.', 'Há um problema em algum lugar.', 'A rede quebrou por uma causa que não observei.', 'Um relato útil descreve o fato e traz uma referência do local.'],
  ['Qual atitude resume o cuidado com o bairro?', 'Observar, manter distância e comunicar.', 'Resolver o problema antes de avisar.', 'Aproximar-se do risco para obter uma fotografia.', 'Nenhuma fotografia ou relato justifica se colocar em risco.'],
] as const

export function demoQuestions(index: number) {
  const scenario = scenarios[index]
  if (!scenario) throw new Error('Módulo de demonstração sem perguntas.')
  const questions = [
    { statement: scenario[0], choices: [scenario[1], scenario[2], scenario[3]], correct: 0, explanation: scenario[4] },
    { statement: 'Se uma fotografia exigir que você se aproxime do risco, como agir?', choices: ['Aproximar-se rapidamente.', 'Pedir a outra pessoa para se aproximar.', 'Manter distância e relatar somente o que puder observar em segurança.'], correct: 2, explanation: 'A fotografia só deve ser feita de um ponto seguro, sem exposição ao risco.' },
    { statement: 'Que informações devem acompanhar o relato?', choices: ['Uma hipótese sobre a causa, mesmo sem evidências.', 'O que foi observado e uma referência para localizar a situação.', 'Dados pessoais de todas as pessoas próximas.'], correct: 1, explanation: 'Descreva o fato com clareza e indique o local, sem adivinhar causas ou divulgar dados pessoais desnecessários.' },
  ]
  return questions.map((question, position) => ({
    order: position + 1,
    statement: question.statement,
    explanationTitle: 'Entenda a orientação',
    explanationBody: question.explanation,
    options: { create: question.choices.map((text, option) => ({ text, isCorrect: option === question.correct })) },
  }))
}

export function demoTraining(content: string) {
  const paragraphs = content.split(/\r?\n\s*\r?\n/).map(text => text.trim()).filter(Boolean)
  const [title, introText, objectives, ...guidance] = paragraphs
  if (!title || !introText || !objectives) throw new Error('Texto de demonstração incompleto.')
  return [
    { order: 1, kind: 'RECOGNIZE' as const, title, introText, cards: { create: [{ order: 1, title: 'O que você vai aprender', description: objectives }] } },
    { order: 2, kind: 'INFO' as const, title: 'Pratique a observação segura', cards: { create: guidance.filter(text => !text.startsWith('Conteúdo de demonstração')).map((description, index) => ({ order: index + 1, title: index === 0 ? 'Como agir' : 'Ao comunicar', description })) } },
    {
      order: 3, kind: 'DO_NOT' as const, title: 'O que NÃO fazer',
      introText: 'Toda etapa de risco tem esta parte. Sua segurança vem antes de tudo.',
      cards: { create: [
        { order: 1, title: 'Não empurre nem encoste no poste', description: 'Ele pode cair de repente.' },
        { order: 2, title: 'Não toque em fios, nem com objetos', description: 'Vassoura, galho ou cano também conduzem energia.' },
        { order: 3, title: 'Não chegue perto para fotografar', description: 'Foto de longe já resolve.' },
        { order: 4, title: 'Não tente consertar ou isolar a área', description: 'Isso é trabalho da equipe técnica.' },
      ] },
    },
  ]
}

type ExistingStep = {
  order: number; title: string; kind: string; introText: string | null; durationMinutes: number | null
  cards: { order: number; title: string; description: string }[]
}

export function isLegacyDemoTraining(content: string, steps: ExistingStep[]): boolean {
  if (steps.length !== 2) return false
  if (content.split(/\r?\n\s*\r?\n/).filter(text => text.trim()).length < 3) return false
  const expected = demoTraining(content).slice(0, 2)
  return steps.every((step, index) => {
    const template = expected[index]
    return template !== undefined && step.order === template.order && step.title === template.title && step.kind === template.kind
      && step.introText === (template.introText ?? null) && step.durationMinutes === null
      && JSON.stringify(step.cards.map(({ order, title, description }) => ({ order, title, description }))) === JSON.stringify(template.cards.create)
  })
}
