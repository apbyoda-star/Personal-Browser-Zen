// Vector: post-install fixups applied after `npm i`.
// These patch known incompatibilities in surfer's transitive dependencies.
// Safe to re-run; each fixup is idempotent.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

let changed = 0

// FIXUP 1 — Node >= 26 removed the `recursive` option from fs.rmdir().
// async-icns@1.0.2 (used by surfer to generate the macOS .icns during branding)
// still calls rmdir(dir, {recursive:true}) and throws ERR_INVALID_ARG_VALUE,
// which makes `npm run import` fail at "Apply branding patches".
const icns = 'node_modules/async-icns/icns.js'
if (existsSync(icns)) {
  let s = readFileSync(icns, 'utf8')
  const before = s
  s = s.replace(
    "const { mkdir, rmdir } = require('fs/promises')",
    "const { mkdir, rm } = require('fs/promises')"
  )
  s = s.replace(
    'await rmdir(tmpDirectory, { recursive: true })',
    'await rm(tmpDirectory, { recursive: true, force: true })'
  )
  if (s !== before) {
    writeFileSync(icns, s)
    console.log('[vector-fixups] patched async-icns for Node >= 26 (fs.rmdir -> fs.rm)')
    changed++
  }
}

if (!changed) console.log('[vector-fixups] nothing to patch (already current)')
