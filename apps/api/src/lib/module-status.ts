export type ModuleStatus = 'blocked' | 'available' | 'in_progress' | 'completed'

export function getModuleStatus(progress: { completedAt: Date | null } | undefined, previousCompleted: boolean): ModuleStatus {
  if (!previousCompleted) return 'blocked'
  if (progress?.completedAt) return 'completed'
  return progress ? 'in_progress' : 'available'
}
