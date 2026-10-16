import { getPrisma } from '../../lib/prisma.js'

export async function listNeighborhoods(municipalityCode = '2111300') {
  return getPrisma().neighborhood.findMany({
    where: { municipalityCode },
    select: { id: true, name: true, municipalityCode: true, municipalityName: true, state: true, source: true },
    orderBy: { name: 'asc' },
  })
}
