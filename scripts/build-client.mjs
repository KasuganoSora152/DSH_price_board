import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pricingPath = join(root, 'src', 'pricing.js')
const templatePath = join(root, 'src', 'client.template.js')
const outputPath = join(root, 'client.js')

const pricing = await readFile(pricingPath, 'utf8')
const template = await readFile(templatePath, 'utf8')
const inlined = pricing.replace(/^export\s+/gm, '')
const output = template.replace('    // __PRICING__', inlined.trimEnd())

if (process.argv.includes('--check')) {
  if (!existsSync(outputPath)) {
    console.error('client.js is missing; run node scripts/build-client.mjs')
    process.exit(1)
  }
  const current = await readFile(outputPath, 'utf8')
  if (current !== output) {
    console.error('client.js is out of date; run node scripts/build-client.mjs')
    process.exit(1)
  }
  console.log('client.js is up to date')
} else {
  await writeFile(outputPath, output, 'utf8')
  console.log(`wrote ${outputPath}`)
}
