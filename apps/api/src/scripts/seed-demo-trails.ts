import 'dotenv/config'
import { getPrisma } from '../lib/prisma.js'
import { demoQuestions, demoTraining } from './demo-learning.js'

const trailId = 'd3e00000-0000-4000-8000-000000000001'
const modules = [
  {
    title: 'O olhar do Guardião',
    description: 'Conheça seu papel e aprenda a observar o bairro com segurança.',
    durationMinutes: 4,
    content: `Seu primeiro passo como Guardião

Observar e comunicar ajudam a cuidar do bairro. O Guardião identifica situações de risco e informa a equipe responsável; intervenções na rede ficam com profissionais autorizados.

- Reconhecer situações que merecem atenção.
- Observar de um local seguro.
- Descrever o que você viu com clareza.

Ao perceber algo diferente, mantenha distância e observe apenas o que for possível sem se expor. Não toque em fios, postes ou equipamentos danificados.

Seu relato pode trazer uma referência do local e uma descrição objetiva. Se for possível fotografar, faça isso de longe, sem se aproximar para conseguir uma imagem melhor.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Fios e cabos caídos',
    description: 'Saiba reconhecer um cabo caído e comunicar a situação.',
    durationMinutes: 5,
    content: `Um fio caído merece atenção

Um cabo no chão, sobre uma árvore ou preso em outro objeto pode representar risco. A aparência do fio não permite confirmar se ele está energizado.

- Reconhecer fios baixos, soltos ou caídos.
- Manter distância do fio e dos objetos em contato com ele.
- Informar o local sem tentar mover o cabo.

Não toque, puxe ou tente afastar o fio com objetos. Evite a área e avise outras pessoas a partir de um ponto seguro. A avaliação deve ser feita pela equipe responsável.

No relato, descreva onde o cabo está e use um ponto de referência que ajude a localizar a ocorrência.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Postes e equipamentos',
    description: 'Observe sinais de danos em postes e equipamentos da rede.',
    durationMinutes: 5,
    content: `Observe sem se aproximar

Um poste inclinado, uma estrutura quebrada ou um equipamento com sinais visíveis de dano pode exigir avaliação da equipe técnica.

- Identificar sinais visíveis de danos na estrutura.
- Descrever faíscas ou fumaça quando forem observadas de longe.
- Usar referências do bairro para indicar o local.

Não toque no poste, não abra caixas e não tente subir na estrutura. Caso veja faíscas ou fumaça, afaste-se e comunique a situação pelos canais de atendimento.

Um relato útil descreve o que foi observado. A classificação do risco fica com a equipe responsável.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Árvores perto da rede',
    description: 'Entenda como relatar galhos e objetos próximos aos fios.',
    durationMinutes: 4,
    content: `Vegetação e objetos próximos aos fios

Galhos e objetos presos perto da rede precisam de avaliação especializada. Mesmo uma ação que parece simples pode colocar você em risco.

- Observar galhos e objetos a partir de um local seguro.
- Evitar podas e a retirada de objetos perto dos fios.
- Informar uma referência para a equipe localizar o ponto.

Não tente retirar pipas, galhos ou outros objetos. Não use varas, escadas ou ferramentas perto da rede. Deixe a intervenção para profissionais autorizados.

Descreva o que está próximo aos fios e onde a situação foi vista, sem se aproximar para confirmar detalhes.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Chuva e alagamentos',
    description: 'Aprenda a observar situações de risco em períodos de chuva.',
    durationMinutes: 5,
    content: `Cuidado redobrado em dias de chuva

Chuva, alagamentos e danos na rede podem acontecer ao mesmo tempo. O registro de uma ocorrência deve ser feito apenas quando você estiver em segurança.

- Evitar áreas alagadas próximas a equipamentos elétricos.
- Não se aproximar de fios caídos para fotografar.
- Priorizar sua segurança antes de enviar um relato.

Não atravesse uma área de risco para verificar uma ocorrência. Se o caminho não for seguro, não avance. Registre somente as informações que já puder observar sem exposição.

Informe o endereço ou uma referência e descreva a presença de água e os danos visíveis, quando houver.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Um relato que ajuda',
    description: 'Organize as informações para enviar um relato claro e útil.',
    durationMinutes: 6,
    content: `Clareza ajuda a equipe a entender

Uma descrição objetiva facilita a análise. Conte o que você observou, em qual local e quais referências podem ajudar a equipe a encontrar o ponto.

- Descrever o fato sem adivinhar sua causa.
- Informar endereço ou ponto de referência.
- Fotografar de longe, somente se for seguro.

Exemplo de descrição: “Observei um cabo baixo próximo à praça do bairro, em frente ao ponto de ônibus.”

Não publique informações pessoais desnecessárias. Se outras pessoas já relataram a situação, acrescente apenas informações novas que sejam relevantes. A validação e a classificação são feitas pela equipe.

Conteúdo de demonstração para visualizar a trilha.`,
  },
  {
    title: 'Seu bairro mais seguro',
    description: 'Revise o que aprendeu e leve o cuidado para o dia a dia.',
    durationMinutes: 4,
    content: `Observar, manter distância e comunicar

O cuidado com o bairro começa com atitudes simples. Você pode ajudar ao reconhecer situações diferentes e comunicar o que observou, sem tentar resolver problemas na rede.

- Revisar os sinais de risco apresentados na trilha.
- Priorizar a segurança em qualquer registro.
- Compartilhar orientações de cuidado com outras pessoas.

Antes de enviar um relato, confira se a descrição e a referência do local estão claras. A equipe responsável fará a avaliação e definirá os próximos passos.

Continue praticando a observação segura. Nenhuma fotografia ou relato justifica se colocar em risco.

Conteúdo de demonstração para visualizar a trilha.`,
  },
] as const

const db = getPrisma()
try {
  const result = await db.$transaction(async tx => {
    const existing = await tx.trail.findUnique({ where: { id: trailId }, select: { id: true, title: true, _count: { select: { modules: true } } } })
    if (existing) {
      let enriched = 0
      for (const [index] of modules.entries()) {
        const id = `d3e10000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
        const module = await tx.trailModule.findUnique({ where: { id }, select: { trailId: true, content: true, _count: { select: { quizQuestions: true, trainingSteps: true } } } })
        if (!module || module.trailId !== trailId) continue
        // Preserva conteúdos estruturados já cadastrados no painel e todos os progressos.
        if (module._count.quizQuestions !== 0 || module._count.trainingSteps !== 0) continue
        await tx.trailModule.update({ where: { id }, data: {
          requiresQuiz: true,
          quizQuestions: { create: demoQuestions(index) },
          trainingSteps: { create: demoTraining(module.content) },
        } })
        enriched++
      }
      return { created: false, id: existing.id, title: existing.title, modules: existing._count.modules, enriched }
    }

    const aggregate = await tx.trail.aggregate({ _max: { order: true } })
    const trail = await tx.trail.create({
      data: {
        id: trailId,
        title: 'Segurança no seu bairro',
        description: 'Trilha de demonstração com sete módulos para conhecer a experiência do Guardião, observar riscos e comunicar situações com segurança.',
        order: (aggregate._max.order ?? 0) + 1,
        publicationStatus: 'PUBLISHED',
        modules: { create: modules.map((module, index) => ({
          ...module,
          id: `d3e10000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          order: index + 1,
          publicationStatus: 'PUBLISHED' as const,
          isActive: true,
          requiresQuiz: true,
          quizQuestions: { create: demoQuestions(index) },
          trainingSteps: { create: demoTraining(module.content) },
        })) },
      },
      select: { id: true, title: true, _count: { select: { modules: true } } },
    })
    return { created: true, id: trail.id, title: trail.title, modules: trail._count.modules }
  }, { isolationLevel: 'Serializable', timeout: 60000 })
  console.log(JSON.stringify(result))
} finally { await db.$disconnect() }
