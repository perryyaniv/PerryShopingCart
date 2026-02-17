import { createContext, useContext, useState, useCallback } from 'react'

const NotificationContext = createContext(null)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])

  const showNotification = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random()
    const notification = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration || 5000,
      showUndo: options.showUndo || false,
      onUndo: options.onUndo,
      timestamp: Date.now()
    }

    setNotifications(prev => [...prev, notification])

    // Auto-dismiss unless persistent
    if (!options.persistent && notification.duration > 0) {
      setTimeout(() => {
        hideNotification(id)
      }, notification.duration)
    }

    return id
  }, [])

  const hideNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const value = {
    notifications,
    showNotification,
    hideNotification,
    clearAllNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export default NotificationProvider
