import { getPiConfigPath, getOpenCodeConfigPath } from '#src/index.js'
import fs from 'node:fs/promises'

export default defineEventHandler(async (_event) => {
  const piPath = getPiConfigPath()
  const opencodePath = getOpenCodeConfigPath()

  let piExists = false
  try { await fs.access(piPath); piExists = true } catch {}

  let opencodeExists = false
  try { await fs.access(opencodePath); opencodeExists = true } catch {}

  return {
    cloud: Boolean(process.env.VERCEL),
    pi: { path: piPath, exists: piExists },
    opencode: { path: opencodePath, exists: opencodeExists }
  }
})
