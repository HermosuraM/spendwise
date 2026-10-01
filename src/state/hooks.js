import { useContext } from 'react'
import { DataContext, PrefsContext, SessionContext } from './contexts'

function useRequiredContext(context, name) {
  const value = useContext(context)
  if (!value) throw new Error(`${name} must be used inside its provider`)
  return value
}

export const useData = () => useRequiredContext(DataContext, 'useData')
export const usePrefs = () => useRequiredContext(PrefsContext, 'usePrefs')
export const useSession = () => useContext(SessionContext)
