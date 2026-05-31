import { createContext, useContext, useState, useEffect } from 'react'

const PermissionModeContext = createContext()

export function PermissionModeProvider({ children }) {
  const [permissionModeEnabled, setPermissionModeEnabled] = useState(() => {
    // Leer del localStorage o usar valor por defecto
    const saved = localStorage.getItem('permissionModeEnabled')
    return saved ? JSON.parse(saved) : false
  })

  const [showPermissionToggle, setShowPermissionToggle] = useState(() => {
    // Mostrar el switch solo si el usuario tiene permisos configurados
    const saved = localStorage.getItem('showPermissionToggle')
    return saved ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('permissionModeEnabled', JSON.stringify(permissionModeEnabled))
  }, [permissionModeEnabled])

  useEffect(() => {
    localStorage.setItem('showPermissionToggle', JSON.stringify(showPermissionToggle))
  }, [showPermissionToggle])

  const togglePermissionMode = () => {
    setPermissionModeEnabled(prev => !prev)
  }

  const enablePermissionToggle = () => {
    setShowPermissionToggle(true)
  }

  const disablePermissionToggle = () => {
    setShowPermissionToggle(false)
  }

  return (
    <PermissionModeContext.Provider value={{
      permissionModeEnabled,
      showPermissionToggle,
      togglePermissionMode,
      enablePermissionToggle,
      disablePermissionToggle,
      setPermissionModeEnabled
    }}>
      {children}
    </PermissionModeContext.Provider>
  )
}

export const usePermissionMode = () => {
  const context = useContext(PermissionModeContext)
  if (context === undefined) {
    throw new Error('usePermissionMode must be used within a PermissionModeProvider')
  }
  return context
}