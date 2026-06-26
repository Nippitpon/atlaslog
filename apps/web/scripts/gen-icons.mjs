// Generate PWA PNG icons from public/favicon.svg.
// Run: node scripts/gen-icons.mjs  (sharp is a devDependency)
import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'public/favicon.svg'))
const BG = { r: 10, g: 10, b: 10, alpha: 1 } // #0a0a0a (matches theme)

async function gen(size, padRatio, out) {
  const inner = Math.round(size * (1 - padRatio * 2))
  const logo = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const outPath = resolve(root, out)
  mkdirSync(dirname(outPath), { recursive: true })
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outPath)
  console.log('wrote', out)
}

await gen(192, 0.14, 'public/icons/icon-192.png')
await gen(512, 0.14, 'public/icons/icon-512.png')
await gen(512, 0.22, 'public/icons/icon-512-maskable.png') // extra safe-zone padding
await gen(180, 0.14, 'public/apple-touch-icon.png')
console.log('done')
