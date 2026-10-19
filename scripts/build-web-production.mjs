import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Valores públicos devem vir do ambiente de deploy, nunca do .env de desenvolvimento.
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_IA_URL']) {
  let url
  try { url = new URL(process.env[name] ?? '') } catch { throw new Error(`${name} deve conter a URL HTTPS de produção.`) }
  if (url.protocol !== 'https:' || /^(localhost|127\.|\[::1\])/.test(url.hostname)) {
    throw new Error(`${name} deve apontar para um serviço HTTPS público.`)
  }
}

const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)),
  'export', '--platform', 'web',
], {
  cwd: fileURLToPath(new URL('../apps/mobile', import.meta.url)),
  stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
