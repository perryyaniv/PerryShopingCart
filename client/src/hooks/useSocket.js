import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const useSocket = (serverUrl) => {
  const socketRef = useRef(null)

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketRef.current.on('connect', () => {
      console.log('🔌 Connected to server')
    })

    socketRef.current.on('disconnect', () => {
      console.log('🔌 Disconnected from server')
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error)
    })

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl])

  return socketRef.current
}

export default useSocket
