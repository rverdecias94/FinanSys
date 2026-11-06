/**
 * Empaqueta PNGs 16/32/48 en un .ico (PNG-compressed ICO, soportado por Chrome/Edge/Firefox).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const entries = [
  { size: 16, file: '_fav16.png' },
  { size: 32, file: '_fav32.png' },
  { size: 48, file: '_fav48.png' },
].map(({ size, file }) => ({ size, data: fs.readFileSync(path.join(pub, file)) }))

const headerSize = 6 + 16 * entries.length
const buffers = []
let offset = headerSize

const header = Buffer.alloc(headerSize)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type = icon
header.writeUInt16LE(entries.length, 4)

entries.forEach((entry, i) => {
  const o = 6 + i * 16
  header.writeUInt8(entry.size >= 256 ? 0 : entry.size, o)
  header.writeUInt8(entry.size >= 256 ? 0 : entry.size, o + 1)
  header.writeUInt8(0, o + 2) // colors
  header.writeUInt8(0, o + 3) // reserved
  header.writeUInt16LE(1, o + 4) // planes
  header.writeUInt16LE(32, o + 6) // bit count
  header.writeUInt32LE(entry.data.length, o + 8)
  header.writeUInt32LE(offset, o + 12)
  offset += entry.data.length
  buffers.push(entry.data)
})

const out = path.join(pub, 'favicon-v3.ico')
fs.writeFileSync(out, Buffer.concat([header, ...buffers]))
console.log(`Wrote ${out} (${fs.statSync(out).size} bytes)`)
