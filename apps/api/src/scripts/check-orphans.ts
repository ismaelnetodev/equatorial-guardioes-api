import 'dotenv/config'
import { getPrisma } from '../lib/prisma.js'

type Hit = { count: number; ids: string[] }

function hits(ids: string[]): Hit {
  return { count: ids.length, ids }
}

/**
 * Lista awards, extrato e contas que apontam para usuário, módulo, trilha ou relato inexistentes.
 * Não altera o banco.
 */
async function checkOrphans() {
  const db = getPrisma()
  const [users, modules, trails, reports, awards, ledger, accounts] = await Promise.all([
    db.user.findMany({ select: { id: true } }),
    db.trailModule.findMany({ select: { id: true } }),
    db.trail.findMany({ select: { id: true } }),
    db.report.findMany({ select: { id: true } }),
    db.learningAward.findMany({
      select: { id: true, userId: true, moduleId: true, trailId: true },
      orderBy: { id: 'asc' },
    }),
    db.pointLedgerEntry.findMany({
      select: { id: true, userId: true, sourceType: true, sourceId: true },
      orderBy: { id: 'asc' },
    }),
    db.pointAccount.findMany({ select: { userId: true }, orderBy: { userId: 'asc' } }),
  ])

  const userIds = new Set(users.map((row) => row.id))
  const moduleIds = new Set(modules.map((row) => row.id))
  const trailIds = new Set(trails.map((row) => row.id))
  const reportIds = new Set(reports.map((row) => row.id))

  const awardMissingUser: string[] = []
  const awardMissingModule: string[] = []
  const awardMissingTrail: string[] = []
  for (const award of awards) {
    if (!userIds.has(award.userId)) awardMissingUser.push(award.id)
    if (award.moduleId && !moduleIds.has(award.moduleId)) awardMissingModule.push(award.id)
    if (award.trailId && !trailIds.has(award.trailId)) awardMissingTrail.push(award.id)
  }

  const ledgerMissingUser: string[] = []
  const ledgerMissingReport: string[] = []
  const ledgerMissingModule: string[] = []
  const ledgerMissingTrail: string[] = []
  for (const entry of ledger) {
    if (!userIds.has(entry.userId)) ledgerMissingUser.push(entry.id)
    if (entry.sourceType === 'Report' && entry.sourceId && !reportIds.has(entry.sourceId)) {
      ledgerMissingReport.push(entry.id)
    }
    if ((entry.sourceType === 'TrailModule' || entry.sourceType === 'Module') && entry.sourceId && !moduleIds.has(entry.sourceId)) {
      ledgerMissingModule.push(entry.id)
    }
    if (entry.sourceType === 'Trail' && entry.sourceId && !trailIds.has(entry.sourceId)) {
      ledgerMissingTrail.push(entry.id)
    }
  }

  const accountMissingUser = accounts.filter((row) => !userIds.has(row.userId)).map((row) => row.userId)

  return {
    awards: {
      missingUser: hits(awardMissingUser),
      missingModule: hits(awardMissingModule),
      missingTrail: hits(awardMissingTrail),
    },
    ledger: {
      missingUser: hits(ledgerMissingUser),
      missingReport: hits(ledgerMissingReport),
      missingModule: hits(ledgerMissingModule),
      missingTrail: hits(ledgerMissingTrail),
    },
    pointAccounts: {
      missingUser: hits(accountMissingUser),
    },
  }
}

try {
  const result = await checkOrphans()
  console.log(JSON.stringify(result, null, 2))
} finally {
  await getPrisma().$disconnect()
}
