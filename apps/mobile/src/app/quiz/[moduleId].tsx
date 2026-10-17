import { Redirect, useLocalSearchParams } from 'expo-router'

export default function QuizRoute() {
  const { moduleId, phase, trailId } = useLocalSearchParams<{ moduleId?: string; phase?: string; trailId?: string }>()
  if (!moduleId) return <Redirect href="/trilha" />
  return <Redirect href={{
    pathname: '/aprender',
    params: { moduleId, phase: phase === 'post' || phase === 'pos' ? 'pos' : 'pre', ...(trailId ? { trailId } : {}) },
  }} />
}
