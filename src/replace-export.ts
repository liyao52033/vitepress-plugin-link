import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dtsPath = resolve(__dirname, '../dist/index.d.ts')
if (existsSync(dtsPath)) {
  let content = readFileSync(dtsPath, 'utf-8')
  content = content.replace(/export\s*=\s*;?/g, 'export default ')
  writeFileSync(dtsPath, content, 'utf-8')
  console.log('Replaced export in dist/index.d.ts')
} else {
  console.warn('dist/index.d.ts not found')
}