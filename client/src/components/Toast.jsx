import { useState, useEffect } from 'react'

const Toast = ({ notification, onClose, darkMode }) => {
  const { id, message, type, duration, showUndo, onUndo } = notification
  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (duration <= 0) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(id), 300)
  }

  const handleUndo = () => {
    if (onUndo) {
      onUndo()
      handleClose()
    }
  }

  // Type-based styling
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return darkMode
          ? 'border-l-green-500 bg-green-900/10'
          : 'border-l-green-600 bg-green-50'
      case 'error':
        return darkMode
          ? 'border-l-red-500 bg-red-900/10'
          : 'border-l-red-600 bg-red-50'
      case 'warning':
        return darkMode
          ? 'border-l-yellow-500 bg-yellow-900/10'
          : 'border-l-yellow-600 bg-yellow-50'
      case 'info':
      default:
        return darkMode
          ? 'border-l-blue-500 bg-blue-900/10'
          : 'border-l-blue-600 bg-blue-50'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      case 'info':
      default:
        return 'ℹ'
    }
  }

  const getProgressColor = () => {
    switch (type) {
      case 'success':
        return darkMode ? 'bg-green-500' : 'bg-green-600'
      case 'error':
        return darkMode ? 'bg-red-500' : 'bg-red-600'
      case 'warning':
        return darkMode ? 'bg-yellow-500' : 'bg-yellow-600'
      case 'info':
      default:
        return darkMode ? 'bg-blue-500' : 'bg-blue-600'
    }
  }

  return (
    <div
      className={`relative p-4 rounded-xl border shadow-lg transition-all duration-300 ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
      } border-l-4 ${getTypeStyles()} ${
        isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-slide-up'
      } overflow-hidden`}
      style={{ minWidth: '300px', maxWidth: '400px' }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
            type === 'success'
              ? darkMode
                ? 'bg-green-500/20 text-green-400'
                : 'bg-green-100 text-green-600'
              : type === 'error'
              ? darkMode
                ? 'bg-red-500/20 text-red-400'
                : 'bg-red-100 text-red-600'
              : type === 'warning'
              ? darkMode
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-yellow-100 text-yellow-600'
              : darkMode
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-blue-100 text-blue-600'
          }`}
        >
          {getIcon()}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            {message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className={`flex-shrink-0 p-1 rounded transition-colors ${
            darkMode
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Undo button */}
      {showUndo && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleUndo}
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
              darkMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Undo
          </button>
        </div>
      )}

      {/* Progress bar */}
      {duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-1 ${getProgressColor()} transition-all`}
          style={{
            width: `${progress}%`,
            transitionDuration: '100ms'
          }}
        />
      )}
    </div>
  )
}

export default Toast
