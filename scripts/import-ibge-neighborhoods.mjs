// Converte o DBF do ZIP do IBGE em SQL revisável. Não acessa o banco.
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Uso: node scripts/import-ibge-neighborhoods.mjs arquivo.zip migration.sql')
const zip = readFileSync(input)
let dbf
for (let p = 0; p < zip.length - 46; p++) {
  if (zip.readUInt32LE(p) !== 0x02014b50) continue
  const nameLength = zip.readUInt16LE(p + 28)
  const name = zip.subarray(p + 46, p + 46 + nameLength).toString()
  if (!name.endsWith('.dbf')) continue
  const local = zip.readUInt32LE(p + 42)
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
  const compressed = zip.subarray(start, start + zip.readUInt32LE(p + 20))
  const method = zip.readUInt16LE(p + 10)
  if (method !== 0 && method !== 8) throw new Error('Compressão ZIP não suportada')
  dbf = method === 8 ? inflateRawSync(compressed) : compressed
  break
}
if (!dbf) throw new Error('DBF não encontrado no ZIP')
const fields = []
let offset = 1
for (let p = 32; dbf[p] !== 13; p += 32) {
  const length = dbf[p + 16]
  fields.push({ name: dbf.subarray(p, p + 11).toString().replace(/\0.*/, ''), offset, length })
  offset += length
}
const rows = new Map()
const municipalities = new Map()
for (let i = 0; i < dbf.readUInt32LE(4); i++) {
  const start = dbf.readUInt16LE(8) + i * dbf.readUInt16LE(10)
  if (dbf[start] === 42) continue
  const row = Object.fromEntries(fields.map(f => [f.name, dbf.subarray(start + f.offset, start + f.offset + f.length).toString('utf8').trim()]))
  if (!row.CD_BAIRRO || !row.NM_BAIRRO || row.CD_UF !== '21') throw new Error('Registro inválido no DBF')
  rows.set(row.CD_BAIRRO, row)
  municipalities.set(row.CD_MUN, row.NM_MUN)
}
const quote = value => "'" + value.replaceAll("'", "''") + "'"
const values = [...rows.values()].sort((a, b) => a.CD_BAIRRO.localeCompare(b.CD_BAIRRO)).map(r =>
  '(' + [r.CD_BAIRRO, r.NM_BAIRRO, r.CD_MUN, r.NM_MUN, 'MA', 'IBGE Censo 2022'].map(quote).join(', ') + ')')
const sql = `-- Fonte: MA_bairros_CD2022.zip fornecido pelo usuário; IBGE Censo 2022.
-- SHA256: ${createHash('sha256').update(zip).digest('hex')}
-- Não contém bairros do município de São Luís (2111300).
INSERT INTO "Neighborhood" ("id", "name", "municipalityCode", "municipalityName", "state", "source") VALUES
${values.join(',\n')}
ON CONFLICT ("id") DO NOTHING;
`
writeFileSync(output, sql)
console.log(`${rows.size} bairros. Municípios: ${[...municipalities.values()].join(', ')}. São Luís: ${[...rows.values()].filter(r => r.CD_MUN === '2111300').length}.`)
