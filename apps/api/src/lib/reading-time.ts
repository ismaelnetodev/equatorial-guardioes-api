type ReadingContent = {
  content?: string | null
  requiresQuiz?: boolean
  trainingSteps?: { title: string; introText: string | null; cards: { title: string; description: string }[] }[]
}

// Product estimate, kept in seconds so short modules do not round up to minutes.
const wordsPerMinute = 200

export function estimateReadingSeconds(module: ReadingContent): number {
  const text = module.requiresQuiz && module.trainingSteps?.length
    ? module.trainingSteps.flatMap(step => [step.title, step.introText ?? '', ...step.cards.flatMap(card => [card.title, card.description])]).join(' ')
    : module.content ?? ''
  const visible = text.replace(/```[^\n]*\n?/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+/g, ' ')
  const words = visible.match(/[\p{L}\p{N}]+(?:['’’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  return Math.ceil(words * 60 / wordsPerMinute)
}
