import { Redirect, useLocalSearchParams } from 'expo-router'

export default function LegacyLearnRoute() {
  const { moduleId, trailId, phase, result, completed } = useLocalSearchParams<{
    moduleId?: string
    trailId?: string
    phase?: string
    result?: string
    completed?: string
  }>()

  if (!moduleId) return <Redirect href="/trilha" />

  return <Redirect href={{
    pathname: '/modulo/aprender',
    params: {
      moduleId,
      ...(trailId ? { trailId } : {}),
      phase: phase === 'training' ? 'training' : phase === 'pos' ? 'pos' : 'pre',
      result: result === '1' ? '1' : '0',
      completed: completed === '1' ? '1' : '0',
    },
  }} />
}
