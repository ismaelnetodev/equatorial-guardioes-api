import { getPrisma } from './prisma.js'
import type { PointsDb } from './points-ledger.js'

export type GuardianLevelCode = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

export interface GuardianLevelView {
  code: GuardianLevelCode
  name: string
  nextLevel: { code: GuardianLevelCode; name: string } | null
  pointsToNextLevel: number | null
  thresholds: {
    silver: number
    gold: number
    platinum: number
  }
}

const LEVEL_NAMES: Record<GuardianLevelCode, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Prata',
  GOLD: 'Ouro',
  PLATINUM: 'Platina',
}

async function readThreshold(key: string, fallback: number, db: PointsDb): Promise<number> {
  const row = await db.programConfiguration.findUnique({
    where: { key },
    select: { value: true, isActive: true },
  })
  if (!row?.isActive || row.value == null || row.value < 0) return fallback
  return row.value
}

export async function resolveGuardianLevel(
  accumulated: number,
  db: PointsDb = getPrisma(),
): Promise<GuardianLevelView> {
  const silver = await readThreshold('level_silver_threshold', 250, db)
  const gold = await readThreshold('level_gold_threshold', 600, db)
  const platinum = await readThreshold('level_platinum_threshold', 1200, db)

  let code: GuardianLevelCode = 'BRONZE'
  if (accumulated >= platinum) code = 'PLATINUM'
  else if (accumulated >= gold) code = 'GOLD'
  else if (accumulated >= silver) code = 'SILVER'

  const nextCode: GuardianLevelCode | null =
    code === 'BRONZE' ? 'SILVER' : code === 'SILVER' ? 'GOLD' : code === 'GOLD' ? 'PLATINUM' : null
  const nextThreshold =
    nextCode === 'SILVER' ? silver : nextCode === 'GOLD' ? gold : nextCode === 'PLATINUM' ? platinum : null

  return {
    code,
    name: LEVEL_NAMES[code],
    nextLevel: nextCode ? { code: nextCode, name: LEVEL_NAMES[nextCode] } : null,
    pointsToNextLevel: nextThreshold == null ? null : Math.max(0, nextThreshold - accumulated),
    thresholds: { silver, gold, platinum },
  }
}
