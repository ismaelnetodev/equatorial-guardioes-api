import 'dotenv/config'
import process from 'node:process'
import { buildApp } from './app.js'

async function main() {
  const app = await buildApp()
  const port = Number(process.env['PORT'] ?? 3000)

  await app.listen({ port })

  const close = async () => {
    await app.close()
    process.exit(0)
  }
  process.once('SIGINT', () => {
    void close()
  })
  process.once('SIGTERM', () => {
    void close()
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
