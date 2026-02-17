import { useNotification } from '../context/NotificationContext'
import Toast from './Toast'

const ToastContainer = ({ darkMode }) => {
  const { notifications, hideNotification } = useNotification()

  // Limit to max 5 notifications
  const visibleNotifications = notifications.slice(-5)

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        top: '1.5rem',
        right: '1.5rem',
        left: 'auto'
      }}
    >
      <div className="flex flex-col gap-3 pointer-events-auto">
        {visibleNotifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={hideNotification}
            darkMode={darkMode}
          />
        ))}
      </div>
    </div>
  )
}

export default ToastContainer
