// Composable: state global aplikasi
export const useAppState = () => {
  const rawModels = useState('rawModels', () => [])
  const selectedModelIds = useState('selectedModelIds', () => new Set())
  const activeTab = useState('activeTab', () => 'pi')
  const generatedConfigs = useState('generatedConfigs', () => ({ pi: null, opencode: null }))
  const profiles = useState('profiles', () => [])
  const systemStatus = useState('systemStatus', () => ({ cloud: false, pi: false, opencode: false }))

  return {
    rawModels,
    selectedModelIds,
    activeTab,
    generatedConfigs,
    profiles,
    systemStatus
  }
}
