import { extractModelsList, toPiConfig, toOpenCodeConfig } from '../../src/index.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    providerId = 'custom-provider',
    baseUrl = '',
    api = 'openai-completions',
    apiKey = '',
    models = [],
    selectedModelIds = null
  } = body ?? {}

  const rawList = extractModelsList(models)

  const piConfig = toPiConfig({ providerId, baseUrl, api, apiKey, models: rawList, selectedModelIds })
  const opencodeConfig = toOpenCodeConfig({ providerId, baseUrl, apiKey, models: rawList, selectedModelIds })

  return {
    ok: true,
    piConfig,
    opencodeConfig,
    modelCount: rawList.length
  }
})
