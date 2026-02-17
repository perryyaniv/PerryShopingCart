import { useState, useCallback, useEffect, useRef } from 'react'

const useUndo = () => {
  const [undoMap, setUndoMap] = useState(new Map())
  const undoMapRef = useRef(new Map())

  // Clean up expired undo records
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setUndoMap(prevMap => {
        const newMap = new Map(prevMap)
        let hasChanges = false

        for (const [id, record] of newMap.entries()) {
          if (now > record.expiresAt) {
            newMap.delete(id)
            undoMapRef.current.delete(id)
            hasChanges = true
          }
        }

        return hasChanges ? newMap : prevMap
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const recordAction = useCallback((type, data, rollbackFn) => {
    const id = `undo-${Date.now()}-${Math.random()}`
    const expiresAt = Date.now() + 5000 // 5 seconds

    const record = {
      id,
      type,
      data,
      rollback: rollbackFn,
      expiresAt
    }

    setUndoMap(prevMap => {
      const newMap = new Map(prevMap)
      newMap.set(id, record)
      undoMapRef.current.set(id, record)
      return newMap
    })

    return id
  }, [])

  const performUndo = useCallback(async (undoId) => {
    const record = undoMapRef.current.get(undoId)

    if (!record) {
      console.warn('Undo record not found or expired:', undoId)
      return
    }

    // Check if expired
    if (Date.now() > record.expiresAt) {
      console.warn('Undo expired:', undoId)
      clearUndo(undoId)
      return
    }

    try {
      // Execute the rollback function
      await record.rollback()

      // Remove the undo record
      clearUndo(undoId)
    } catch (error) {
      console.error('Error performing undo:', error)
      throw error
    }
  }, [])

  const clearUndo = useCallback((undoId) => {
    setUndoMap(prevMap => {
      const newMap = new Map(prevMap)
      newMap.delete(undoId)
      undoMapRef.current.delete(undoId)
      return newMap
    })
  }, [])

  return {
    recordAction,
    performUndo,
    clearUndo
  }
}

export default useUndo
