import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** 公開するアプリに同梱してよい寛容ライセンス */
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Apache-2.0',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
])

/**
 * ビルド時だけ使い、成果物に含めないもの。
 * MPL-2.0 の lightningcss は Vite の CSS 変換で、サイトには入らない。
 */
const DEV_ONLY = new Set(['MPL-2.0'])

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))

function acceptable(license, devOnly) {
  if (typeof license !== 'string' || license.trim() === '') return false
  const allowed = devOnly ? new Set([...ALLOWED, ...DEV_ONLY]) : ALLOWED
  const groups = license
    .replace(/[()]/g, ' ')
    .split(/\s+OR\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
  return groups.some((group) =>
    group
      .split(/\s+AND\s+/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .every((part) => allowed.has(part)),
  )
}

function licenseOf(name, info) {
  if (typeof info.license === 'string' && info.license !== '') return info.license
  const pkgPath = join(process.cwd(), name, 'package.json')
  if (!existsSync(pkgPath)) return null
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (typeof pkg.license === 'string') return pkg.license
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((item) => item.type).join(' OR ')
  return null
}

const rejected = []
for (const [name, info] of Object.entries(lock.packages)) {
  if (name === '') continue
  const license = licenseOf(name, info)
  const devOnly = info.dev === true || info.devOptional === true
  if (!acceptable(license, devOnly)) rejected.push(`${name}: ${license ?? 'ライセンス不明'}`)
}

if (rejected.length > 0) {
  console.error('MIT と両立しない、または不明なライセンスがあります:')
  for (const line of rejected) console.error(`  ${line}`)
  process.exit(1)
}

console.log(`license-check OK (${Object.keys(lock.packages).length - 1} packages)`)
