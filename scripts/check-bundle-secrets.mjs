#!/usr/bin/env node
/* Fails the build if a server-only secret reached the browser bundle.

   .env.example has promised this check since step 1. It exists now.

   Two passes, because a leaked NAME is only a proxy for the harm while a
   leaked VALUE is the harm itself:

   - Names come from .env.example - every declared variable that does not
     start with VITE_. Adding a server-only var to the template extends this
     check automatically, with no second list to drift out of sync.
   - Values come from .env plus the live process env. Best-effort: .env is
     absent on Vercel, so the name pass is the one that always runs.

   Sourcemaps are read too. They are the classic leak path and the easy one
   to forget. */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DIST = 'dist'
const READ = new Set(['.js', '.css', '.html', '.map'])
/* Below this, a value is too short to be matched without false positives. */
const MIN_VALUE = 12

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const serverOnly = Object.keys(parseEnvFile('.env.example')).filter((n) => !n.startsWith('VITE_'))
if (serverOnly.length === 0) {
  console.error('check-bundle-secrets: no server-only names found in .env.example. Refusing to pass vacuously.')
  process.exit(1)
}

const known = { ...parseEnvFile('.env'), ...process.env }
const values = serverOnly
  .map((name) => [name, (known[name] ?? '').trim()])
  .filter(([, v]) => v.length >= MIN_VALUE)

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (READ.has(extname(path))) yield path
  }
}

if (!existsSync(DIST)) {
  console.error(`check-bundle-secrets: ${DIST}/ does not exist. Run the build first.`)
  process.exit(1)
}

const mask = (v) => `${v.slice(0, 4)}${'*'.repeat(Math.max(0, Math.min(v.length - 4, 12)))}`
const hits = []
let scanned = 0

for (const file of walk(DIST)) {
  scanned += 1
  const text = readFileSync(file, 'utf8')
  for (const name of serverOnly) {
    if (text.includes(name)) hits.push(`${file}: contains the name ${name}`)
  }
  for (const [name, value] of values) {
    if (text.includes(value)) hits.push(`${file}: contains the VALUE of ${name} (${mask(value)})`)
  }
}

if (hits.length > 0) {
  console.error('\ncheck-bundle-secrets: server-only material reached the bundle.\n')
  for (const hit of hits) console.error(`  ${hit}`)
  console.error('\nAnything VITE_-prefixed is inlined at build time. These must not be.\n')
  process.exit(1)
}

console.log(
  `check-bundle-secrets: ${scanned} files clean ` +
    `(${serverOnly.length} names, ${values.length} values checked).`,
)
