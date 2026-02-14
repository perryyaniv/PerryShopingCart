import { useState, useEffect } from 'react'
import axios from 'axios'

/**
 * Custom hook to monitor server connection status
 * Tracks axios requests and updates connection state accordingly
 * @param {string} apiBaseUrl - The base URL of the API server
 * @returns {string} Connection status: 'connected' | 'disconnected' | 'checking'
 */
export default function useConnectionStatus(apiBaseUrl) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    // Set up axios interceptor to monitor all requests
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        // Successful response means server is reachable
        setStatus('connected')
        return response
      },
      (error) => {
        // Check if it's a network error (server unreachable)
        // ERR_NETWORK or no response means server is down
        if (error.code === 'ERR_NETWORK' || !error.response) {
          setStatus('disconnected')
        }
        // For other errors (4xx, 5xx), server is up but returning errors
        // So we don't change the status to disconnected

        return Promise.reject(error)
      }
    )

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [apiBaseUrl])

  return status
}
