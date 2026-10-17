import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const shapes = {
  pole: '<path d="m14 3-4 18M6 21h11M9 8l11 3M15 3l4 2M15 9l-1 6"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM12 14v6M8 21h8M7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  shield: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5l8-3Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
}
for (const [name, shape] of Object.entries(shapes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`
  await sharp(Buffer.from(svg), { density: 288 }).png().toFile(fileURLToPath(new URL(`../apps/mobile/assets/trail-${name}.png`, import.meta.url)))
}
