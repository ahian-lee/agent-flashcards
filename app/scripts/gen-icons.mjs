#!/usr/bin/env node
/**
 * Generates the PWA icons with zero dependencies:
 * a hand-rolled PNG encoder (zlib deflate + CRC32) drawing a solid indigo tile
 * with a white letter "A", antialiased by 4x4 supersampling.
 *
 * Outputs (public/):
 *   icons/icon-192.png          normal, rounded corners, transparent outside
 *   icons/icon-512.png          normal, rounded corners
 *   icons/icon-512-maskable.png full-bleed square, glyph inside the 80% safe zone
 *   apple-touch-icon.png        180px, full-bleed (iOS applies its own mask)
 *   favicon.svg                 crisp vector equivalent
 *
 * Usage: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const publicDir = join(appRoot, 'public')
const iconsDir = join(publicDir, 'icons')

const BG = [79, 70, 229] // #4f46e5
const FG = [255, 255, 255]

// ----------------------------------------------------------------- PNG codec
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------ drawing
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** Rounded-rect containment test (used for the non-maskable tiles). */
function insideRoundedRect(x, y, size, radius) {
  const inner = { x0: radius, y0: radius, x1: size - radius, y1: size - radius }
  if (x >= inner.x0 && x <= inner.x1) return y >= 0 && y <= size
  if (y >= inner.y0 && y <= inner.y1) return x >= 0 && x <= size
  const cornerX = x < radius ? radius : size - radius
  const cornerY = y < radius ? radius : size - radius
  return Math.hypot(x - cornerX, y - cornerY) <= radius
}

/** Coverage of the letter "A" stroke at a point (1 = fully inside). */
function letterACoverage(x, y, size, scale) {
  const centreX = size / 2
  const centreY = size / 2
  const height = size * 0.52 * scale
  const halfWidth = size * 0.26 * scale
  const strokeWidth = size * 0.115 * scale

  const apexY = centreY - height / 2
  const baseY = centreY + height / 2
  const apexX = centreX
  const leftX = centreX - halfWidth
  const rightX = centreX + halfWidth

  const distance = Math.min(
    distanceToSegment(x, y, apexX, apexY, leftX, baseY),
    distanceToSegment(x, y, apexX, apexY, rightX, baseY),
  )

  // crossbar sits 34% above the base
  const barY = baseY - height * 0.34
  const t = (barY - apexY) / (baseY - apexY)
  const barLeftX = apexX + (leftX - apexX) * t
  const barRightX = apexX + (rightX - apexX) * t
  const barDistance = distanceToSegment(x, y, barLeftX, barY, barRightX, barY)

  return Math.min(distance, barDistance) <= strokeWidth / 2 ? 1 : 0
}

function renderIcon(size, { maskable = false, glyphScale = 1 } = {}) {
  const samples = 4
  const radius = maskable ? 0 : size * 0.22
  const buffer = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples
          const inTile = maskable || insideRoundedRect(px, py, size, radius)
          if (!inTile) continue
          const glyph = letterACoverage(px, py, size, glyphScale)
          r += BG[0] + (FG[0] - BG[0]) * glyph
          g += BG[1] + (FG[1] - BG[1]) * glyph
          b += BG[2] + (FG[2] - BG[2]) * glyph
          a += 255
        }
      }
      const total = samples * samples
      const offset = (y * size + x) * 4
      const alpha = a / total
      if (alpha === 0) {
        buffer[offset] = 0
        buffer[offset + 1] = 0
        buffer[offset + 2] = 0
        buffer[offset + 3] = 0
        continue
      }
      const covered = a / 255
      buffer[offset] = Math.round(r / covered)
      buffer[offset + 1] = Math.round(g / covered)
      buffer[offset + 2] = Math.round(b / covered)
      buffer[offset + 3] = Math.round(alpha)
    }
  }

  return encodePng(size, size, buffer)
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Agent 闪卡">
  <rect width="64" height="64" rx="14" fill="#4f46e5"/>
  <path d="M21 46 L32 17 L43 46 M25.5 37.5 H38.5" fill="none" stroke="#ffffff" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`

mkdirSync(iconsDir, { recursive: true })

const targets = [
  { file: join(iconsDir, 'icon-192.png'), size: 192, options: { glyphScale: 1 } },
  { file: join(iconsDir, 'icon-512.png'), size: 512, options: { glyphScale: 1 } },
  { file: join(iconsDir, 'icon-512-maskable.png'), size: 512, options: { maskable: true, glyphScale: 0.78 } },
  { file: join(publicDir, 'apple-touch-icon.png'), size: 180, options: { maskable: true, glyphScale: 0.92 } },
]

for (const target of targets) {
  const png = renderIcon(target.size, target.options)
  writeFileSync(target.file, png)
  console.log(`  ✓ ${target.file.replace(appRoot + '\\', '')}  ${target.size}x${target.size}  ${png.length} bytes`)
}

writeFileSync(join(publicDir, 'favicon.svg'), FAVICON_SVG, 'utf8')
console.log(`  ✓ favicon.svg  ${FAVICON_SVG.length} bytes`)
