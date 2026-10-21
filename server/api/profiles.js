import { loadProfiles, upsertProfile, getProfilesPath } from '#src/profiles.js'

const profilesPath = getProfilesPath()

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const profiles = await loadProfiles(profilesPath).catch((err) => {
      throw createError({ statusCode: 500, statusMessage: err.message })
    })
    return { profiles }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { name, providerId, baseUrl, api, apiKey } = body ?? {}

    if (typeof name !== 'string' || name.trim() === '') {
      throw createError({ statusCode: 400, statusMessage: 'Profile name is required and must be non-empty' })
    }

    for (const field of ['providerId', 'baseUrl', 'api', 'apiKey']) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        throw createError({ statusCode: 400, statusMessage: `Profile ${field} must be a string` })
      }
    }

    const profile = await upsertProfile({ name, providerId, baseUrl, api, apiKey }, profilesPath).catch((err) => {
      throw createError({ statusCode: 500, statusMessage: err.message })
    })
    return { ok: true, profile }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
