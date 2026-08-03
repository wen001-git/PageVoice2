import { readFileSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'

const source = process.argv[2]
if (!source) {
  throw new Error('Usage: node scripts/build-dictionary.mjs <ecdict.csv>')
}

const outputDir = resolve('public/dictionary')
mkdirSync(outputDir, { recursive: true })
for (const file of readdirSync(outputDir)) {
  if (file.endsWith('.json')) unlinkSync(resolve(outputDir, file))
}

const rows = parse(readFileSync(source), {
  columns: true,
  bom: true,
  relax_quotes: true,
  relax_column_count: true,
  skip_empty_lines: true,
})

const eligible = rows
  .filter((row) => {
    const word = row.word || ''
    const acronym = word.length > 1 && word === word.toUpperCase()
    return /^[A-Za-z][A-Za-z'-]*$/.test(word) && !acronym && (row.translation || '').trim()
  })
  .map((row) => {
    const frq = Number(row.frq) || 9999999
    const bnc = Number(row.bnc) || 9999999
    const tagged = /(^|\s)(zk|gk|cet4|cet6|ky|ielts|toefl)(\s|$)/i.test(row.tag || '')
    return { row, score: Math.min(frq, bnc) - (tagged ? 2000000 : 0) }
  })
  .sort((a, b) => a.score - b.score)
  .slice(0, 50000)

const shards = new Map()
const lemmas = {}

function shardFor(word) {
  const normalized = word.toLowerCase()
  const prefix = normalized.slice(0, 2).padEnd(2, '_')
  if (!shards.has(prefix)) shards.set(prefix, {})
  return shards.get(prefix)
}

for (const { row } of eligible) {
  const word = row.word.toLowerCase()
  const shard = shardFor(word)
  if (!shard[word]) {
    shard[word] = {
      p: row.phonetic || '',
      t: row.translation.split(/\\n|\n/).filter(Boolean).slice(0, 4),
    }
  }

  for (const item of String(row.exchange || '').split('/')) {
    const separator = item.indexOf(':')
    if (separator < 0) continue
    for (const form of item.slice(separator + 1).split(',')) {
      const normalized = form.trim().toLowerCase()
      if (/^[a-z][a-z'-]*$/.test(normalized) && normalized !== word) lemmas[normalized] = word
    }
  }
}

const files = []
for (const [prefix, entries] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const file = `${prefix}.json`
  writeFileSync(resolve(outputDir, file), JSON.stringify(entries))
  files.push(file)
}
writeFileSync(resolve(outputDir, 'lemmas.json'), JSON.stringify(lemmas))
writeFileSync(
  resolve(outputDir, 'index.json'),
  JSON.stringify({ version: 1, count: eligible.length, files: ['lemmas.json', ...files] }),
)

console.log(`Built ${eligible.length} dictionary entries in ${files.length} shards.`)
