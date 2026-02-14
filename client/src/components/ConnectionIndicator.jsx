/**
 * ConnectionIndicator Component
 * Displays the current server connection status with an icon
 * Shows different icons and colors based on connection state
 */
export default function ConnectionIndicator({ status, darkMode, serverUrl }) {
  // Configuration for each connection state
  const statusConfig = {
    connected: {
      text: 'Connected',
      bgColor: 'bg-green-500',
      ringColor: 'ring-green-500/30'
    },
    disconnected: {
      text: 'Disconnected',
      bgColor: 'bg-red-500',
      ringColor: 'ring-red-500/30'
    },
    checking: {
      text: 'Checking connection...',
      bgColor: 'bg-yellow-500',
      ringColor: 'ring-yellow-500/30',
      animate: true
    }
  }

  const config = statusConfig[status] || statusConfig.checking

  return (
    <div
      className="relative group cursor-help"
      title={config.text}
    >
      <div
        className={`w-3 h-3 rounded-full transition-all duration-300 ring-2 ${config.bgColor} ${config.ringColor} ${
          config.animate ? 'animate-pulse' : ''
        }`}
      ></div>

      {/* Tooltip */}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 ${
        darkMode
          ? 'bg-slate-800 text-white border border-slate-700'
          : 'bg-gray-900 text-white'
      }`}>
        <div className="font-semibold">{config.text}</div>
        {serverUrl && (
          <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-300'}`}>
            {serverUrl}
          </div>
        )}
        <div className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent ${
          darkMode ? 'border-t-slate-800' : 'border-t-gray-900'
        }`}></div>
      </div>
    </div>
  )
}
