import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const assets = new URL('../apps/mobile/assets/', import.meta.url)
const path = name => fileURLToPath(new URL(name, assets))
const symbol = await readFile(path('energy-symbol.svg'))
const appIcon = await readFile(path('app-icon.svg'))

await sharp(await readFile(path('lencois.svg')), { density: 216 }).png().toFile(path('lencois.png'))
// Darken the dunes and blend the illustration into the login screen background.
const loginShade = Buffer.from('<svg width="1080" height="900" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d123d" stop-opacity="0"/><stop offset=".4" stop-color="#0d123d" stop-opacity=".25"/><stop offset=".6" stop-color="#0d123d" stop-opacity=".65"/><stop offset="1" stop-color="#0d123d"/></linearGradient></defs><path fill="url(#shade)" d="M0 0h1080v900H0z"/></svg>')
await sharp(path('lencois.png')).resize(1080, 900).composite([{ input: loginShade }]).png().toFile(path('lencois-login.png'))

await sharp(symbol, { density: 288 }).trim().png().toFile(path('energy-symbol.png'))
await sharp(appIcon, { density: 576 }).resize(1024, 1024).flatten({ background: '#0B1240' }).png().toFile(path('icon.png'))
await sharp(appIcon, { density: 288 }).resize(64, 64).png().toFile(path('favicon.png'))
const foreground = await sharp(Buffer.from(appIcon.toString().replace(/<rect\b[^>]*\/>/, '')), { density: 576 }).resize(640, 640).png().toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } }).composite([{ input: foreground, gravity: 'centre' }]).png().toFile(path('android-icon-foreground.png'))
await sharp(symbol, { density: 288 }).trim().resize(512, 512, { fit: 'contain', background: '#00000000' }).png().toFile(path('splash-icon.png'))
await sharp(await readFile(path('google.svg')), { density: 288 }).resize(96, 96).png().toFile(path('google.png'))
