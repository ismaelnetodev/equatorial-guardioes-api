import 'dotenv/config'
import { getPrisma } from '../lib/prisma.js'
import { normalizeNeighborhoodLabel } from '../modules/community/community.service.js'

const MUNICIPALITY_CODE = '2111300'

async function backfill() {
  const db = getPrisma()
  const catalog = await db.neighborhood.findMany({
    where: { municipalityCode: MUNICIPALITY_CODE },
    select: { id: true, name: true },
  })
  const byNormalized = new Map(catalog.map((item) => [normalizeNeighborhoodLabel(item.name), item]))

  const unmatchedUsers: Array<{ id: string; neighborhood: string }> = []
  const unmatchedReports: Array<{ id: string; neighborhood: string }> = []
  let usersMatched = 0
  let usersSkipped = 0
  let reportsMatched = 0
  let reportsSkipped = 0

  const users = await db.user.findMany({
    where: { neighborhoodId: null },
    select: { id: true, neighborhood: true },
    orderBy: { id: 'asc' },
  })
  for (const user of users) {
    const match = byNormalized.get(normalizeNeighborhoodLabel(user.neighborhood))
    if (!match) {
      unmatchedUsers.push({ id: user.id, neighborhood: user.neighborhood })
      continue
    }
    await db.user.update({ where: { id: user.id }, data: { neighborhoodId: match.id } })
    usersMatched += 1
  }
  usersSkipped = users.length - usersMatched - unmatchedUsers.length

  const reports = await db.report.findMany({
    where: { neighborhoodId: null },
    select: { id: true, neighborhood: true },
    orderBy: { id: 'asc' },
  })
  for (const report of reports) {
    const match = byNormalized.get(normalizeNeighborhoodLabel(report.neighborhood))
    if (!match) {
      unmatchedReports.push({ id: report.id, neighborhood: report.neighborhood })
      continue
    }
    await db.report.update({ where: { id: report.id }, data: { neighborhoodId: match.id } })
    reportsMatched += 1
  }
  reportsSkipped = reports.length - reportsMatched - unmatchedReports.length

  console.log(JSON.stringify({
    catalogSize: catalog.length,
    users: { scanned: users.length, matched: usersMatched, skipped: usersSkipped, unmatched: unmatchedUsers },
    reports: { scanned: reports.length, matched: reportsMatched, skipped: reportsSkipped, unmatched: unmatchedReports },
  }, null, 2))
}

try {
  await backfill()
} finally {
  await getPrisma().$disconnect()
}
