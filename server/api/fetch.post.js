import { fetchModels } from '#src/index.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { baseUrl, apiKey, timeoutMs } = body ?? {}

  if (!baseUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Base URL is required' })
  }

  const result = await fetchModels({ baseUrl, apiKey, timeoutMs }).catch((err) => {
    throw createError({ statusCode: 500, statusMessage: err.message })
  })

  return {
    ok: true,
    url: result.url,
    count: result.models.length,
    models: result.models,
    rawResponse: result.rawResponse
  }
})
