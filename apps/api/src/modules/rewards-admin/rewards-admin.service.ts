import { Prisma, type ProgramConfigurationKind, type ProgramConfiguration } from '../../generated/prisma/client.js'
import { getPrisma } from '../../lib/prisma.js'
import type { HistoryQuery, UpdateConfiguration } from './rewards-admin.schemas.js'

export class ConfigurationError extends Error {
  constructor(public readonly code: 'CONFIGURATION_NOT_FOUND' | 'INVALID_CONFIGURATION' | 'CONFIGURATION_CONFLICT', message: string) { super(message) }
}

function view(row: ProgramConfiguration) {
  return { ...row, updatedAt: row.updatedAt.toISOString() }
}

export async function listConfigurations(kind: ProgramConfigurationKind) {
  return (await getPrisma().programConfiguration.findMany({ where: { kind }, orderBy: { key: 'asc' } })).map(view)
}

export async function updateConfiguration(kind: ProgramConfigurationKind, key: string, input: UpdateConfiguration, actorId: string) {
  try {
    return await getPrisma().$transaction(async tx => {
      const before = await tx.programConfiguration.findUnique({ where: { key } })
      if (!before || before.kind !== kind) throw new ConfigurationError('CONFIGURATION_NOT_FOUND', 'Configuração não encontrada nesta categoria.')
      // Ausência de valor só é aceita para parâmetros ainda não definidos no documento.
      if (input.value === null && before.value !== null) throw new ConfigurationError('INVALID_CONFIGURATION', 'Um valor já definido não pode ser removido; desative a configuração se necessário.')
      if (input.value !== undefined && input.value !== null && before.unit === 'percent' && input.value > 100) throw new ConfigurationError('INVALID_CONFIGURATION', 'Percentuais devem estar entre 0 e 100.')
      if (kind === 'RULE' && input.value === null) throw new ConfigurationError('INVALID_CONFIGURATION', 'Informe os pontos da regra.')
      if (kind === 'REWARD' && key === 'certificate' && input.value !== undefined) throw new ConfigurationError('INVALID_CONFIGURATION', 'O certificado depende da conclusão da trilha, sem preço de resgate em pontos.')
      const data = { ...(input.value !== undefined ? { value: input.value } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) }
      if ((input.value === undefined || input.value === before.value) && (input.isActive === undefined || input.isActive === before.isActive)) return view(before)
      const after = await tx.programConfiguration.update({ where: { key }, data })
      await tx.programConfigurationChange.create({ data: { key, kind, before: view(before), after: view(after), actorId, reason: input.reason?.trim() ?? null } })
      return view(after)
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2025'].includes(error.code)) throw new ConfigurationError('CONFIGURATION_CONFLICT', 'A configuração foi alterada simultaneamente. Consulte os valores e tente novamente.')
    throw error
  }
}

export async function listConfigurationHistory(query: HistoryQuery) {
  const rows = await getPrisma().programConfigurationChange.findMany({
    where: { ...(query.kind ? { kind: query.kind } : {}), ...(query.key ? { key: query.key } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.offset ?? 0, take: query.limit ?? 50,
  })
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }))
}
