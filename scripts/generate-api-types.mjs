import { mkdir, writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'
import { buildApp } from '../apps/api/src/app.ts'

const app = await buildApp({ logger: false })
try {
  await app.ready()
  const schema = app.swagger()
  const ast = await openapiTS(schema)
  const destination = new URL('../apps/mobile/src/services/api.types.ts', import.meta.url)
  await mkdir(new URL('.', destination), { recursive: true })
  await writeFile(destination, '// Gerado automaticamente por npm run api:types. Não editar manualmente.\n' + astToString(ast))
  console.log('Contratos do mobile gerados a partir do OpenAPI da API.')
} finally { await app.close() }
