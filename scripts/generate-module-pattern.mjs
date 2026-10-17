import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300" viewBox="0 0 320 150"><defs><pattern id="tiles" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#0d123d"/><g fill="none" stroke="#293898" stroke-width="3"><circle cx="0" cy="0" r="10"/><circle cx="50" cy="50" r="10"/><ellipse cx="25" cy="25" rx="16" ry="3"/><ellipse cx="25" cy="25" rx="3" ry="16"/><ellipse cx="25" cy="25" rx="16" ry="3" transform="rotate(50 25 25)"/><ellipse cx="25" cy="25" rx="16" ry="3" transform="rotate(-50 25 25)"/></g></pattern></defs><rect width="320" height="150" fill="url(#tiles)"/></svg>`
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('../apps/mobile/assets/module-pattern.png', import.meta.url)))
