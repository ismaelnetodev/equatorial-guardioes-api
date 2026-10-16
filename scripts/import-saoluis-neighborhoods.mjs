import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Uso: node scripts/import-saoluis-neighborhoods.mjs pagina.html migration.sql')
const html = readFileSync(input, 'utf8')
const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const groups = [...text.matchAll(/Microrregional ([^;:.]+?) - abrange (?:os bairros |o )?([^;.]+)[;.]/g)]
if (groups.length !== 50) throw new Error(`Esperadas 50 microrregionais; encontradas ${groups.length}. Revise a fonte.`)
const names = [...new Set(groups.flatMap(m => m[2].split(/, | e /)).map(n => n.trim()))].sort((a,b) => a.localeCompare(b, 'pt-BR'))
// A conjunção faz parte destes nomes próprios, não separa bairros.
for (const [parts, full] of [[['Sol', 'Mar'], 'Sol e Mar']]) {
  for (const part of parts) { const index = names.indexOf(part); if (index >= 0) names.splice(index, 1) }
  names.push(full)
}
names.sort((a,b) => a.localeCompare(b, 'pt-BR'))
const quote = s => "'" + s.replaceAll("'", "''") + "'"
const values = names.map(name => {
  const id = 'slz-' + createHash('sha256').update(name).digest('hex').slice(0, 16)
  return '(' + [id, name, '2111300', 'São Luís', 'MA', 'Prefeitura de São Luís / SEMGOP 2022'].map(quote).join(', ') + ')'
})
writeFileSync(output, `-- Fonte municipal (não são códigos de bairros do IBGE):
-- https://www.saoluis.ma.gov.br/portal/noticias/0/3/2172/ludovicenses-com-16-anos-ou-mais-poderao-votar-para-eleger-conselho-municipal-do-orcamento-participativo
-- Relação publicada em 28/04/2022. Extraída em 16/10/2026.
-- SHA256 HTML: ${createHash('sha256').update(html).digest('hex')}
-- Nomes repetidos entre microrregionais unificados; grafia da fonte preservada.
INSERT INTO "Neighborhood" ("id", "name", "municipalityCode", "municipalityName", "state", "source") VALUES
${values.join(',\n')}
ON CONFLICT ("id") DO NOTHING;
`)
console.log(`${groups.length} microrregionais; ${names.length} nomes únicos.`)

