import { Redirect, useLocalSearchParams } from 'expo-router'

export default function QuizRoute() {
  const { moduleId, phase, trailId } = useLocalSearchParams<{ moduleId?: string; phase?: string; trailId?: string }>()
  if (!moduleId) return <Redirect href="/trilha" />
  return <Redirect href={{
    pathname: '/modulo/aprender',
    params: { moduleId, phase: phase === 'post' || phase === 'pos' ? 'pos' : 'pre', result: '0', completed: '0', ...(trailId ? { trailId } : {}) },
  }} />
}
