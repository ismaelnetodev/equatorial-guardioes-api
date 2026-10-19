import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'

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
  'export', '--platform', 'web', '--clear',
], {
  cwd: fileURLToPath(new URL('../apps/mobile', import.meta.url)),
  stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
const bundleDir = new URL('../apps/mobile/dist/_expo/static/js/web/', import.meta.url)
const bundles = readdirSync(bundleDir).filter(name => name.endsWith('.js'))
  .map(name => readFileSync(new URL(name, bundleDir), 'utf8')).join('\n')
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_IA_URL']) {
  if (!bundles.includes(process.env[name])) {
    throw new Error(`${name} não foi incorporada ao bundle; não publique esta exportação.`)
  }
}
console.log('URLs de produção confirmadas no bundle web.')
