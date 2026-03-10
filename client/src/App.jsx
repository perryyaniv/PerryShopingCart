import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'
import useConnectionStatus from './hooks/useConnectionStatus'
import ConnectionIndicator from './components/ConnectionIndicator'
import ToastContainer from './components/ToastContainer'
import { useNotification } from './context/NotificationContext'
import useUndo from './hooks/useUndo'
import useSocket from './hooks/useSocket'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://perry-shopping-server.onrender.com';

function App() {
  const socket = useSocket(API_BASE_URL)
  const { showNotification } = useNotification()
  const { recordAction, performUndo } = useUndo()

  const [currentUser, setCurrentUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [currentCart, setCurrentCart] = useState(null)
  const [cartMode, setCartMode] = useState(null) // null | 'create' | 'join'
  const [cartNameInput, setCartNameInput] = useState('')
  const [cartCodeInput, setCartCodeInput] = useState('')
  const [cartError, setCartError] = useState('')

  const [activeList, setActiveList] = useState(null)
  const [historyList, setHistoryList] = useState([])
  const [itemName, setItemName] = useState('')
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemCategory, setItemCategory] = useState('General')
  const [itemComment, setItemComment] = useState('')
  const [darkMode, setDarkMode] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('active')
  const [pastUsers, setPastUsers] = useState([])
  const [processingItems, setProcessingItems] = useState(new Set())
  const processingRef = useRef(new Set())
  const [showDemonicMessage, setShowDemonicMessage] = useState(false)
  // Opening screen selector: 1 = No Rest For The Wicked, 2 = Epic Fury
  // Add more options here as new screens are created
  const [openingScreen] = useState(2)
  const connectionStatus = useConnectionStatus(API_BASE_URL)
  const [editingQuantity, setEditingQuantity] = useState(null)
  const [editQuantityValue, setEditQuantityValue] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [editCommentValue, setEditCommentValue] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState(new Set())
  const [categoryOrder, setCategoryOrder] = useState([
    'General',
    'Fruits & Vegetables',
    'Bakery',
    'Dairy',
    'Meat',
    'Frozen',
    'Pantry'
  ])

  // Helper: build a URL scoped to the current cart
  const cartUrl = (path) => `${API_BASE_URL}/cart/${currentCart._id}${path}`

  // Initial ping to establish connection status (needed when no cart is loaded yet)
  useEffect(() => {
    axios.get(API_BASE_URL + '/').catch(() => {})
  }, [])

  // Load persisted data on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('savedCart')
    if (savedCart) {
      try { setCurrentCart(JSON.parse(savedCart)) } catch (e) { /* ignore */ }
    }

    const saved = localStorage.getItem('pastUsers')
    if (saved) {
      const users = JSON.parse(saved)
      setPastUsers(users)
      if (users.length > 0 && !userName) {
        setUserName(users[0])
      }
    }

    const savedCategoryOrder = localStorage.getItem('categoryOrder')
    if (savedCategoryOrder) {
      setCategoryOrder(JSON.parse(savedCategoryOrder))
    }
  }, [])

  // Fetch list and history whenever cart changes
  useEffect(() => {
    if (!currentCart) return
    fetchActiveList()
    fetchHistory()
  }, [currentCart?._id])

  // Retry fetching when disconnected so we detect when the server comes back
  useEffect(() => {
    if (connectionStatus !== 'disconnected' || !currentCart) return
    const interval = setInterval(() => {
      fetchActiveList()
      fetchHistory()
    }, 5000)
    return () => clearInterval(interval)
  }, [connectionStatus, currentCart])

  // Join the cart's Socket.IO room when cart is set
  useEffect(() => {
    if (!socket || !currentCart) return
    socket.emit('join-cart', currentCart._id)
  }, [socket, currentCart?._id])

  const fetchActiveList = async () => {
    if (!currentCart) return
    try {
      const response = await axios.get(`${API_BASE_URL}/cart/${currentCart._id}/list/active`)
      setActiveList(response.data)
    } catch (error) {
      console.error('Error fetching list:', error)
    }
  }

  const fetchHistory = async () => {
    if (!currentCart) return
    try {
      const response = await axios.get(`${API_BASE_URL}/cart/${currentCart._id}/list/history`)
      setHistoryList(response.data)
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return

    socket.on('list-updated', ({ activeList }) => {
      console.log('📡 Received list update')
      setActiveList(activeList)
    })

    socket.on('history-updated', ({ history }) => {
      console.log('📡 Received history update')
      setHistoryList(history)
    })

    return () => {
      socket.off('list-updated')
      socket.off('history-updated')
    }
  }, [socket])

  const handleLoginUser = () => {
    if (userName.trim()) {
      const trimmedName = userName.trim()
      setCurrentUser(trimmedName)
      setUserName('')

      if (!pastUsers.includes(trimmedName)) {
        const updated = [trimmedName, ...pastUsers]
        setPastUsers(updated)
        localStorage.setItem('pastUsers', JSON.stringify(updated))
      }
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
  }

  const handleCreateCart = async () => {
    if (!cartNameInput.trim() || !cartCodeInput.trim()) return
    setCartError('')
    try {
      const res = await axios.post(`${API_BASE_URL}/cart`, {
        name: cartNameInput.trim(),
        code: cartCodeInput.trim()
      })
      const cart = res.data
      setCurrentCart(cart)
      localStorage.setItem('savedCart', JSON.stringify(cart))
      setShowDemonicMessage(true)
      setTimeout(() => setShowDemonicMessage(false), 5000)
    } catch (err) {
      setCartError(err.response?.data?.message || 'Failed to create cart')
    }
  }

  const handleJoinCart = async () => {
    if (!cartCodeInput.trim()) return
    setCartError('')
    try {
      const res = await axios.post(`${API_BASE_URL}/cart/join`, {
        code: cartCodeInput.trim()
      })
      const cart = res.data
      setCurrentCart(cart)
      localStorage.setItem('savedCart', JSON.stringify(cart))
      setShowDemonicMessage(true)
      setTimeout(() => setShowDemonicMessage(false), 5000)
    } catch (err) {
      setCartError(err.response?.data?.message || 'Cart not found')
    }
  }

  const handleSwitchCart = () => {
    setCurrentCart(null)
    localStorage.removeItem('savedCart')
    setCartMode(null)
    setCartNameInput('')
    setCartCodeInput('')
    setCartError('')
    setActiveList(null)
    setHistoryList([])
  }

  const addItem = async () => {
    if (!itemName.trim() || !currentUser) return

    try {
      const trimmedName = itemName.trim()

      const existingItem = activeList?.items.find(
        item => item.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (existingItem) {
        alert(`"${existingItem.name}" is already in your shopping list!`)
        return
      }

      const newItem = {
        name: trimmedName,
        quantity: parseInt(itemQuantity),
        category: itemCategory,
        comment: itemComment.trim(),
        addedBy: currentUser
      }

      const response = await axios.post(cartUrl('/list/active/items'), newItem)
      setActiveList(response.data)

      setItemName('')
      setItemQuantity(1)
      setItemCategory('General')
      setItemComment('')
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const togglePurchased = async (itemId) => {
    if (!activeList || processingRef.current.has(itemId)) {
      console.log('Already processing:', itemId)
      return
    }

    const item = activeList.items.find(i => i._id === itemId)
    if (!item) return

    const itemData = {
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      addedBy: item.addedBy,
      comment: item.comment || '',
      purchased: false
    }

    console.log('Processing item:', itemId)
    processingRef.current.add(itemId)
    setProcessingItems(prev => new Set(prev).add(itemId))

    const capturedCartId = currentCart._id

    try {
      const response = await axios.patch(
        cartUrl(`/list/active/items/${itemId}`),
        { purchased: true }
      )
      setActiveList(response.data)
      await fetchHistory()

      const undoId = recordAction('PURCHASE_ITEM', itemData, async () => {
        await axios.post(`${API_BASE_URL}/cart/${capturedCartId}/list/restore-item`, itemData)
        fetchActiveList()
        fetchHistory()
      })

      showNotification(`"${itemData.name}" marked as purchased`, {
        type: 'success',
        showUndo: true,
        onUndo: () => performUndo(undoId),
        duration: 7000
      })
    } catch (error) {
      console.error('Error marking item as purchased:', error)
    } finally {
      console.log('Done processing:', itemId)
      processingRef.current.delete(itemId)
      setProcessingItems(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  const deleteItem = async (itemId) => {
    try {
      const item = activeList.items.find(i => i._id === itemId)
      if (!item) return

      const itemData = {
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        addedBy: item.addedBy,
        comment: item.comment || ''
      }

      const capturedCartId = currentCart._id

      const response = await axios.delete(cartUrl(`/list/active/items/${itemId}`))
      setActiveList(response.data)

      const undoId = recordAction('DELETE_ITEM', itemData, async () => {
        await axios.post(`${API_BASE_URL}/cart/${capturedCartId}/list/active/items`, itemData)
        fetchActiveList()
      })

      showNotification(`Deleted "${itemData.name}"`, {
        type: 'info',
        showUndo: true,
        onUndo: () => performUndo(undoId)
      })
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const startEditingQuantity = (itemId, currentQuantity) => {
    setEditingQuantity(itemId)
    setEditQuantityValue(currentQuantity.toString())
  }

  const cancelEditingQuantity = () => {
    setEditingQuantity(null)
    setEditQuantityValue('')
  }

  const startEditingComment = (itemId, currentComment) => {
    setEditingComment(itemId)
    setEditCommentValue(currentComment || '')
  }

  const cancelEditingComment = () => {
    setEditingComment(null)
    setEditCommentValue('')
  }

  const updateComment = async (itemId) => {
    try {
      const response = await axios.patch(
        cartUrl(`/list/active/items/${itemId}`),
        { comment: editCommentValue.trim() }
      )
      setActiveList(response.data)
      cancelEditingComment()

      showNotification('Comment updated', { type: 'success', duration: 3000 })
    } catch (error) {
      console.error('Error updating comment:', error)
    }
  }

  const updateQuantity = async (itemId) => {
    const newQuantity = parseInt(editQuantityValue)
    if (isNaN(newQuantity) || newQuantity < 1) {
      alert('Please enter a valid quantity (1 or more)')
      return
    }

    try {
      const response = await axios.patch(
        cartUrl(`/list/active/items/${itemId}`),
        { quantity: newQuantity }
      )
      setActiveList(response.data)
      cancelEditingQuantity()
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  const toggleCategoryCollapse = (category) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const moveCategoryUp = (index) => {
    if (index === 0) return
    const newOrder = [...categoryOrder]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    setCategoryOrder(newOrder)
    localStorage.setItem('categoryOrder', JSON.stringify(newOrder))
  }

  const moveCategoryDown = (index) => {
    if (index === categoryOrder.length - 1) return
    const newOrder = [...categoryOrder]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    setCategoryOrder(newOrder)
    localStorage.setItem('categoryOrder', JSON.stringify(newOrder))
  }

  const getItemsByCategory = () => {
    const filtered = getFilteredItems()
    const grouped = {}

    categoryOrder.forEach(category => {
      grouped[category] = []
    })

    filtered.forEach(item => {
      if (grouped[item.category]) {
        grouped[item.category].push(item)
      } else {
        grouped['General'].push(item)
      }
    })

    return grouped
  }

  const copyFromHistory = async (historyId) => {
    try {
      const response = await axios.post(cartUrl(`/list/copy-from-history/${historyId}`))
      setActiveList(response.data)
      setActiveTab('active')
    } catch (error) {
      console.error('Error copying from history:', error)
    }
  }

  const addItemFromHistory = async (historyItem) => {
    try {
      const trimmedName = historyItem.name.trim()

      const existingItem = activeList?.items.find(
        item => item.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (existingItem) {
        alert(`"${existingItem.name}" is already in your shopping list!`)
        return
      }

      const newItem = {
        name: trimmedName,
        quantity: historyItem.quantity,
        category: historyItem.category,
        addedBy: currentUser
      }

      const response = await axios.post(cartUrl('/list/active/items'), newItem)
      setActiveList(response.data)
    } catch (error) {
      console.error('Error adding item from history:', error)
    }
  }

  const archiveList = async () => {
    try {
      await axios.post(cartUrl('/list/archive'))
      fetchActiveList()
      fetchHistory()
    } catch (error) {
      console.error('Error archiving list:', error)
    }
  }

  const clearList = async () => {
    if (window.confirm('Clear the entire list?')) {
      try {
        const response = await axios.post(cartUrl('/list/clear'))
        setActiveList(response.data)
      } catch (error) {
        console.error('Error clearing list:', error)
      }
    }
  }

  const deleteHistoryEntry = async (historyId) => {
    if (window.confirm('Delete this shopping list from history?')) {
      try {
        const response = await axios.delete(cartUrl(`/list/history/${historyId}`))
        setHistoryList(response.data)
      } catch (error) {
        console.error('Error deleting history entry:', error)
      }
    }
  }

  const deleteHistoryItem = async (historyId, itemId) => {
    try {
      const response = await axios.delete(cartUrl(`/list/history/${historyId}/items/${itemId}`))
      setHistoryList(response.data)
    } catch (error) {
      console.error('Error deleting history item:', error)
    }
  }

  const clearAllHistory = async () => {
    if (window.confirm('Delete ALL shopping history? This cannot be undone.')) {
      try {
        await axios.delete(cartUrl('/list/history'))
        setHistoryList([])
      } catch (error) {
        console.error('Error clearing history:', error)
      }
    }
  }

  const getFilteredItems = () => {
    if (!activeList) return []

    let filtered = activeList.items

    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }

  const pendingCount = activeList?.items.filter(i => !i.purchased).length || 0
  const filteredItems = getFilteredItems()

  const itemExists = activeList?.items.some(
    item => item.name.toLowerCase() === itemName.trim().toLowerCase()
  ) && itemName.trim() !== ''

  // --- Login Screen ---
  if (!currentUser) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${
          darkMode ? 'bg-slate-950' : 'bg-gray-50'
        }`}>
          <div className={`w-full max-w-md mx-4 p-6 md:p-8 rounded-xl border transition-colors duration-300 ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              iShopCart
            </h1>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'} ${connectionStatus === 'connected' ? 'mb-6' : 'mb-4'}`}>
              Enter your name to get started
            </p>

            {connectionStatus !== 'connected' && (
              <div className={`mb-4 p-3 rounded-lg border ${
                darkMode
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    connectionStatus === 'checking' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className={`text-xs font-medium ${
                    darkMode ? 'text-slate-300' : 'text-amber-800'
                  }`}>
                    {connectionStatus === 'checking' ? 'Connecting to server...' : 'Server unavailable. Retrying...'}
                  </span>
                </div>
                <div className={`connecting-progress-bar ${
                  darkMode ? 'bg-slate-700' : 'bg-amber-200'
                }`}>
                  <div className={`h-full w-full ${
                    connectionStatus === 'checking'
                      ? darkMode ? 'bg-amber-400' : 'bg-amber-500'
                      : darkMode ? 'bg-red-400' : 'bg-red-500'
                  }`} style={{ animation: 'progress-slide 1.4s ease-in-out infinite' }} />
                </div>
              </div>
            )}

            <div className="space-y-4">
              {pastUsers.length > 0 ? (
                <>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && connectionStatus === 'connected' && handleLoginUser()}
                    placeholder="Select or type your name"
                    list="usersList"
                    className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                  />
                  <datalist id="usersList">
                    {pastUsers.map((user) => (
                      <option key={user} value={user} />
                    ))}
                  </datalist>

                  <button
                    onClick={() => {
                      setPastUsers([])
                      localStorage.removeItem('pastUsers')
                    }}
                    className={`w-full px-4 py-2 rounded-lg font-medium text-xs transition-all duration-300 ${
                      darkMode
                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    Clear User History
                  </button>
                </>
              ) : (
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && connectionStatus === 'connected' && handleLoginUser()}
                  placeholder="Your name"
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />
              )}

              <button
                onClick={handleLoginUser}
                disabled={connectionStatus !== 'connected'}
                className={`w-full px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                  connectionStatus !== 'connected'
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : darkMode
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              >
                {connectionStatus !== 'connected' ? 'Connecting...' : 'Continue'}
              </button>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-2.5 rounded-lg transition-all duration-300 ${
                darkMode
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Cart Selection Screen ---
  if (!currentCart) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${
          darkMode ? 'bg-slate-950' : 'bg-gray-50'
        }`}>
          <div className={`w-full max-w-md mx-4 p-6 md:p-8 rounded-xl border transition-colors duration-300 ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h1 className={`text-2xl md:text-3xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Hi, {currentUser}!
            </h1>
            <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
              Choose your Cart
            </p>

            {cartMode === null && (
              <div className="space-y-3">
                <button
                  onClick={() => { setCartMode('join'); setCartError(''); setCartCodeInput('') }}
                  className={`w-full px-6 py-4 rounded-lg font-semibold text-sm transition-all duration-300 text-left flex items-center gap-3 ${
                    darkMode
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span className="text-xl">🛒</span>
                  <div>
                    <div>Join a Cart</div>
                    <div className="text-xs font-normal opacity-80">Enter a cart code to join an existing group</div>
                  </div>
                </button>

                <button
                  onClick={() => { setCartMode('create'); setCartError(''); setCartNameInput(''); setCartCodeInput('') }}
                  className={`w-full px-6 py-4 rounded-lg font-semibold text-sm transition-all duration-300 text-left flex items-center gap-3 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200'
                  }`}
                >
                  <span className="text-xl">✨</span>
                  <div>
                    <div>Create a Cart</div>
                    <div className={`text-xs font-normal ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Start a new shared cart for your group</div>
                  </div>
                </button>
              </div>
            )}

            {cartMode === 'join' && (
              <div className="space-y-3">
                <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Enter the cart code shared with you
                </p>
                <input
                  type="text"
                  value={cartCodeInput}
                  onChange={(e) => setCartCodeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinCart()}
                  placeholder="Cart code (e.g. perrycart)"
                  autoFocus
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />
                {cartError && (
                  <p className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{cartError}</p>
                )}
                <button
                  onClick={handleJoinCart}
                  disabled={!cartCodeInput.trim()}
                  className={`w-full px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                    !cartCodeInput.trim()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : darkMode
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Join Cart
                </button>
                <button
                  onClick={() => { setCartMode(null); setCartError('') }}
                  className={`w-full px-4 py-2 rounded-lg font-medium text-xs transition-all duration-300 ${
                    darkMode
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  ← Back
                </button>
              </div>
            )}

            {cartMode === 'create' && (
              <div className="space-y-3">
                <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Give your cart a name and a code to share
                </p>
                <input
                  type="text"
                  value={cartNameInput}
                  onChange={(e) => setCartNameInput(e.target.value)}
                  placeholder="Cart name (e.g. PerryCart)"
                  autoFocus
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />
                <input
                  type="text"
                  value={cartCodeInput}
                  onChange={(e) => setCartCodeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCart()}
                  placeholder="Cart code (e.g. perrycart)"
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  Share this code with your group so they can join
                </p>
                {cartError && (
                  <p className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{cartError}</p>
                )}
                <button
                  onClick={handleCreateCart}
                  disabled={!cartNameInput.trim() || !cartCodeInput.trim()}
                  className={`w-full px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                    !cartNameInput.trim() || !cartCodeInput.trim()
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : darkMode
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Create Cart
                </button>
                <button
                  onClick={() => { setCartMode(null); setCartError('') }}
                  className={`w-full px-4 py-2 rounded-lg font-medium text-xs transition-all duration-300 ${
                    darkMode
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  ← Back
                </button>
              </div>
            )}

            <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
              <button
                onClick={handleLogout}
                className={`text-xs transition-all duration-300 ${
                  darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                ← Not {currentUser}?
              </button>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-2.5 rounded-lg transition-all duration-300 ${
                darkMode
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main App ---
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>
        {/* Demonic Message Overlay — Opening Screen 1: No Rest For The Wicked */}
        {showDemonicMessage && openingScreen === 1 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn px-4"
               style={{
                 background: 'radial-gradient(circle, rgba(139,0,0,0.95) 0%, rgba(0,0,0,0.98) 100%)',
                 animation: 'fadeInOut 5s ease-in-out'
               }}>
            <div className="text-center max-w-full">
              <div className="text-5xl md:text-7xl mb-4 md:mb-6 animate-bounce">
                👹
              </div>
              <div className="flex justify-center gap-3 md:gap-6 mb-4 md:mb-6">
                <span className="text-3xl md:text-5xl animate-pulse">🔥</span>
                <span className="text-3xl md:text-5xl animate-pulse" style={{ animationDelay: '0.2s' }}>🔥</span>
                <span className="text-3xl md:text-5xl animate-pulse" style={{ animationDelay: '0.4s' }}>🔥</span>
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-4 md:mb-6 px-4"
                  style={{
                    color: '#ff3333',
                    WebkitTextStroke: '1px #000000',
                    textShadow: '0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff4500, 0 4px 8px rgba(0,0,0,0.8)',
                    animation: 'glow 1.5s ease-in-out infinite alternate',
                    letterSpacing: '0.05em',
                    lineHeight: '1.2'
                  }}>
                NO REST FOR THE WICKED!
              </h1>
              <div className="flex justify-center gap-3 md:gap-6 mt-4 md:mt-6">
                <span className="text-3xl md:text-5xl animate-pulse" style={{ animationDelay: '0.1s' }}>🔥</span>
                <span className="text-3xl md:text-5xl animate-pulse" style={{ animationDelay: '0.3s' }}>🔥</span>
                <span className="text-3xl md:text-5xl animate-pulse" style={{ animationDelay: '0.5s' }}>🔥</span>
              </div>
            </div>
          </div>
        )}

        {/* Epic Fury Opening Screen — Opening Screen 2 */}
        {showDemonicMessage && openingScreen === 2 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,10,60,0.97) 0%, rgba(0,0,20,0.99) 100%)',
              animation: 'fadeInOut 5s ease-in-out',
            }}
          >
            <div className="text-center max-w-full">

              {/* OPERATION label */}
              <div
                className="text-base md:text-xl font-black mb-1 tracking-widest"
                style={{ color: '#7ab8ff', letterSpacing: '0.45em', textShadow: '0 0 10px #4a8eff' }}
              >
                — OPERATION —
              </div>

              {/* EPIC FURY */}
              <h1
                className="text-5xl sm:text-7xl md:text-9xl font-black mb-4 px-2"
                style={{
                  color: '#CC0000',
                  WebkitTextStroke: '1px rgba(255,255,255,0.25)',
                  textShadow: '0 0 25px #CC0000, 0 0 50px #3366ff, 0 0 80px #CC0000, 0 4px 15px rgba(0,0,0,0.9)',
                  animation: 'epicGlow 1.2s ease-in-out infinite alternate',
                  letterSpacing: '0.1em',
                  lineHeight: '1.05',
                }}
              >
                EPIC FURY
              </h1>

              {/* Combat scene: Alliance ──⚔──▶ Iran */}
              <div className="flex justify-center items-center gap-3 md:gap-6 mb-3">

                {/* Alliance side — Eagle & Lion together */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-4xl md:text-6xl" style={{ animation: 'symbolPulse 1.2s ease-in-out infinite alternate' }}>🦅</span>
                    <span className="text-4xl md:text-6xl" style={{ animation: 'symbolPulse 1.2s ease-in-out infinite alternate', animationDelay: '0.4s' }}>🦁</span>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-xl md:text-2xl">🇺🇸</span>
                    <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 900 }}>+</span>
                    <span className="text-xl md:text-2xl">🇮🇱</span>
                  </div>
                  <span className="text-xs font-bold tracking-widest" style={{ color: '#7ab8ff', letterSpacing: '0.2em' }}>USA · ISRAEL</span>
                </div>

                {/* Strike arrow */}
                <div className="flex flex-col items-center gap-1 px-1">
                  <span className="text-2xl md:text-3xl font-black" style={{ color: '#ffffff', textShadow: '0 0 12px #fff' }}>⚔</span>
                  <span className="text-lg md:text-2xl" style={{ color: '#CC0000', textShadow: '0 0 8px #CC0000' }}>▶▶</span>
                  <span className="text-xs font-black tracking-widest" style={{ color: '#CC0000', letterSpacing: '0.15em' }}>STRIKE</span>
                </div>

                {/* Iran — target side */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl md:text-6xl">💥</span>
                  <span className="text-xl md:text-2xl" style={{ filter: 'grayscale(0.4) brightness(0.75)' }}>🇮🇷</span>
                  <span className="text-xs font-black tracking-widest" style={{ color: '#ff4444', letterSpacing: '0.2em', textDecoration: 'line-through' }}>IRAN</span>
                </div>

              </div>

              {/* Stars & Stars of David */}
              <div className="flex justify-center gap-3 mb-2">
                <span style={{ color: '#CC0000', fontSize: '1.3rem' }}>★</span>
                <span style={{ color: '#7ab8ff', fontSize: '1.3rem' }}>✡</span>
                <span style={{ color: '#CC0000', fontSize: '1.3rem' }}>★</span>
                <span style={{ color: '#FFFFFF', fontSize: '1.3rem' }}>✡</span>
                <span style={{ color: '#CC0000', fontSize: '1.3rem' }}>★</span>
              </div>

              {/* Tagline */}
              <div
                className="text-xs md:text-sm font-bold tracking-widest uppercase"
                style={{ color: '#a0c4ff', letterSpacing: '0.3em', textShadow: '0 0 8px #4a8eff55' }}
              >
                IRON ALLIANCE · UNITED FRONT
              </div>

            </div>
          </div>
        )}

        {/* Header */}
        <div className={`sticky top-0 z-10 border-b transition-colors duration-300 ${
          darkMode
            ? 'bg-slate-900/95 backdrop-blur border-slate-800'
            : 'bg-white/95 backdrop-blur border-gray-200'
        }`}>
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex-1">
                <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  iShopCart
                </h1>
                <p className={`text-xs md:text-sm mt-1 flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  <span>Welcome, {currentUser}</span>
                  <span className={darkMode ? 'text-slate-600' : 'text-gray-300'}>·</span>
                  <button
                    onClick={handleSwitchCart}
                    className={`font-medium transition-all duration-200 ${
                      darkMode
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-blue-600 hover:text-blue-700'
                    }`}
                    title="Switch to a different cart"
                  >
                    🛒 {currentCart.name} ⇄
                  </button>
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <ConnectionIndicator status={connectionStatus} darkMode={darkMode} serverUrl={API_BASE_URL} />
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 md:p-2.5 rounded-lg transition-all duration-300 ${
                    darkMode
                      ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
                <button
                  onClick={handleLogout}
                  className={`px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-300 ${
                    darkMode
                      ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Stats Card */}
          <div className={`mb-6 md:mb-8 p-4 md:p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs md:text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  Items to Buy
                </p>
                <p className={`text-2xl md:text-3xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {pendingCount}
                </p>
              </div>
              <div className={`text-3xl md:text-4xl ${pendingCount === 0 ? 'opacity-100' : 'opacity-50'}`}>
                {pendingCount === 0 ? '✓' : '→'}
              </div>
            </div>
          </div>

          {/* Add Item Section */}
          <div className={`mb-6 md:mb-8 p-4 md:p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-xs md:text-sm font-semibold mb-3 md:mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Add New Item
            </h2>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 md:gap-3 items-stretch sm:items-end">
              <div className="flex-1 min-w-[150px]">
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !itemExists && addItem()}
                  placeholder="Item name"
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-sm ${
                    itemExists
                      ? darkMode
                        ? 'bg-slate-800 border-red-500 text-white placeholder-slate-500'
                        : 'bg-red-50 border-red-400 text-gray-900 placeholder-gray-400'
                      : darkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 ${
                    itemExists ? 'focus:ring-red-500/30' : 'focus:ring-blue-500/30'
                  }`}
                />
                {itemExists && (
                  <p className={`text-xs mt-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                    This item is already in your list
                  </p>
                )}
              </div>

              <div className="flex gap-2 sm:gap-3">
                <input
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  min="1"
                  placeholder="Qty"
                  className={`w-16 sm:w-20 px-2 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />

                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className={`flex-1 px-2 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-xs md:text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                >
                  <option value="General">General</option>
                  <option value="Fruits & Vegetables">Fruits & Veg</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Meat">Meat</option>
                  <option value="Frozen">Frozen</option>
                  <option value="Pantry">Pantry</option>
                </select>
              </div>

              <input
                type="text"
                value={itemComment}
                onChange={(e) => setItemComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !itemExists && addItem()}
                placeholder="Add a comment (optional)"
                className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-sm ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              />

              <button
                onClick={addItem}
                disabled={itemExists}
                className={`w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
                  itemExists
                    ? darkMode
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : darkMode
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              >
                Add
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className={`mb-6 md:mb-8 p-4 md:p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            {/* Tabs */}
            <div className="flex gap-1 md:gap-2 mb-4 md:mb-6 border-b border-gray-300 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 px-3 md:px-6 py-2 md:py-3 font-semibold text-xs md:text-sm transition-all duration-300 border-b-2 ${
                  activeTab === 'active'
                    ? darkMode
                      ? 'border-blue-500 text-blue-400'
                      : 'border-blue-600 text-blue-600'
                    : darkMode
                      ? 'border-transparent text-slate-400 hover:text-slate-300'
                      : 'border-transparent text-gray-500 hover:text-gray-600'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-3 md:px-6 py-2 md:py-3 font-semibold text-xs md:text-sm transition-all duration-300 border-b-2 ${
                  activeTab === 'history'
                    ? darkMode
                      ? 'border-blue-500 text-blue-400'
                      : 'border-blue-600 text-blue-600'
                    : darkMode
                      ? 'border-transparent text-slate-400 hover:text-slate-300'
                      : 'border-transparent text-gray-500 hover:text-gray-600'
                }`}
              >
                History
              </button>
            </div>

            {/* Active Tab Content */}
            {activeTab === 'active' && (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-sm mb-3 md:mb-4 ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button
                    onClick={() => archiveList()}
                    className={`px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-300 ${
                      darkMode
                        ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    Archive List
                  </button>

                  <button
                    onClick={() => clearList()}
                    className={`px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-300 ${
                      darkMode
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    Clear List
                  </button>
                </div>
              </>
            )}

            {/* History Tab Content */}
            {activeTab === 'history' && (
              <>
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search archived items..."
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-300 text-sm mb-3 md:mb-4 ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button
                    onClick={() => clearAllHistory()}
                    className={`px-3 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all duration-300 ${
                      darkMode
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>

          {/* History Items List */}
          {activeTab === 'history' && (
            <div className={`mb-6 md:mb-8 p-4 md:p-6 rounded-xl transition-colors duration-300 border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-gray-200'
            }`}>
              {historyList.length === 0 ? (
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  No archived items found
                </p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const allItems = historyList.flatMap((entry) =>
                      entry.items.map((item) => ({
                        ...item,
                        entryId: entry._id,
                        completedAt: entry.completedAt
                      }))
                    )

                    const uniqueItems = Array.from(
                      allItems.reduce((map, item) => {
                        const key = item.name.toLowerCase()
                        const existing = map.get(key)
                        if (!existing || new Date(item.completedAt) > new Date(existing.completedAt)) {
                          map.set(key, item)
                        }
                        return map
                      }, new Map()).values()
                    )

                    const filteredItems = historySearchQuery.trim()
                      ? uniqueItems.filter(item =>
                          item.name.toLowerCase().includes(historySearchQuery.toLowerCase())
                        )
                      : uniqueItems

                    filteredItems.sort((a, b) => {
                      const aInList = activeList?.items.some(
                        activeItem => activeItem.name.toLowerCase() === a.name.toLowerCase()
                      )
                      const bInList = activeList?.items.some(
                        activeItem => activeItem.name.toLowerCase() === b.name.toLowerCase()
                      )

                      if (aInList !== bInList) {
                        return aInList ? 1 : -1
                      }

                      return new Date(b.completedAt) - new Date(a.completedAt)
                    })

                    if (filteredItems.length === 0) {
                      return (
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          No items match your search
                        </p>
                      )
                    }

                    return filteredItems.map((item) => {
                      const existsInActiveList = activeList?.items.some(
                        activeItem => activeItem.name.toLowerCase() === item.name.toLowerCase()
                      )
                      return (
                        <div
                          key={`${item.entryId}-${item._id}`}
                          className={`p-3 md:p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center gap-3 group ${
                            darkMode
                              ? 'bg-slate-800 border-slate-700 hover:border-blue-500'
                              : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                          } transition-all`}
                        >
                          <div className="flex-1 w-full sm:w-auto">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {item.name}
                              </p>
                              {existsInActiveList && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  darkMode
                                    ? 'bg-green-900/30 text-green-400'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  In list
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1.5 md:mt-1 text-xs">
                              <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded ${
                                darkMode
                                  ? 'bg-blue-900/30 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                Qty: {item.quantity}
                              </span>
                              <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded ${
                                darkMode
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-gray-200 text-gray-700'
                              }`}>
                                {item.category}
                              </span>
                              <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs ${
                                darkMode
                                  ? 'bg-slate-700 text-slate-400'
                                  : 'bg-gray-300 text-gray-600'
                              }`}>
                                {new Date(item.completedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => addItemFromHistory(item)}
                              disabled={existsInActiveList}
                              className={`flex-1 sm:flex-none px-3 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all duration-300 ${
                                existsInActiveList
                                  ? darkMode
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : darkMode
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              Add
                            </button>
                            <button
                              onClick={() => deleteHistoryItem(item.entryId, item._id)}
                              className={`px-3 sm:px-2 py-2 rounded-lg font-medium text-xs transition-all duration-300 ${
                                darkMode
                                  ? 'text-red-400 hover:bg-red-900/20'
                                  : 'text-red-600 hover:bg-red-100'
                              }`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Shopping List - Only show on Active Tab */}
          {activeTab === 'active' && (filteredItems.length === 0 ? (
            <div className={`text-center py-12 md:py-16 rounded-xl border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-gray-200'
            }`}>
              <p className={`text-sm md:text-base font-medium px-4 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {searchQuery
                  ? 'No items match your criteria'
                  : 'No items yet. Add one to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {(() => {
                const itemsByCategory = getItemsByCategory()
                return categoryOrder.map((category, categoryIndex) => {
                  const items = itemsByCategory[category] || []
                  if (items.length === 0) return null

                  const isCollapsed = collapsedCategories.has(category)

                  return (
                    <div
                      key={category}
                      className={`rounded-xl border transition-all duration-300 ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {/* Category Header */}
                      <div
                        className={`flex items-center justify-between p-3 md:p-4 border-b ${
                          darkMode ? 'border-slate-800' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => toggleCategoryCollapse(category)}
                            className={`text-base md:text-lg transition-transform duration-200 flex-shrink-0 ${
                              isCollapsed ? 'rotate-0' : 'rotate-90'
                            }`}
                          >
                            ▶
                          </button>
                          <h3 className={`text-sm md:text-base font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {category}
                          </h3>
                          <span className={`text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex-shrink-0 ${
                            darkMode
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {items.length}
                          </span>
                        </div>
                        <div className="flex gap-0.5 md:gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveCategoryUp(categoryIndex)}
                            disabled={categoryIndex === 0}
                            className={`p-1 md:p-1.5 rounded transition-all text-xs md:text-base ${
                              categoryIndex === 0
                                ? darkMode
                                  ? 'text-slate-700 cursor-not-allowed'
                                  : 'text-gray-300 cursor-not-allowed'
                                : darkMode
                                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveCategoryDown(categoryIndex)}
                            disabled={categoryIndex === categoryOrder.length - 1}
                            className={`p-1 md:p-1.5 rounded transition-all text-xs md:text-base ${
                              categoryIndex === categoryOrder.length - 1
                                ? darkMode
                                  ? 'text-slate-700 cursor-not-allowed'
                                  : 'text-gray-300 cursor-not-allowed'
                                : darkMode
                                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* Category Items */}
                      {!isCollapsed && (
                        <ul className="p-2 md:p-3 space-y-2">
                          {items.map(item => (
                            <li
                              key={item._id}
                              className={`group p-3 md:p-4 rounded-lg transition-all duration-300 border flex items-start gap-2 md:gap-4 ${
                                darkMode
                                  ? `${
                                      item.purchased
                                        ? 'bg-slate-900/50 border-slate-700'
                                        : 'bg-slate-800 border-slate-700 hover:border-blue-500/50'
                                    }`
                                  : `${
                                      item.purchased
                                        ? 'bg-gray-50 border-gray-200'
                                        : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                                    }`
                              } hover:shadow-sm`}
                            >
                              <input
                                type="checkbox"
                                checked={item.purchased}
                                onChange={() => togglePurchased(item._id)}
                                disabled={processingItems.has(item._id)}
                                className={`mt-0.5 md:mt-1.5 w-5 h-5 md:w-5 md:h-5 rounded border-gray-300 accent-blue-600 flex-shrink-0 ${
                                  processingItems.has(item._id) ? 'cursor-wait opacity-50' : 'cursor-pointer'
                                }`}
                              />

                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-xs md:text-sm font-medium transition-all duration-300 break-words ${
                                    item.purchased
                                      ? darkMode
                                        ? 'text-slate-500 line-through'
                                        : 'text-gray-400 line-through'
                                      : darkMode
                                        ? 'text-white'
                                        : 'text-gray-900'
                                  }`}
                                >
                                  {item.name}
                                </div>

                                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1.5 md:mt-2 text-xs">
                                  {editingQuantity === item._id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        value={editQuantityValue}
                                        onChange={(e) => setEditQuantityValue(e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            updateQuantity(item._id)
                                          } else if (e.key === 'Escape') {
                                            cancelEditingQuantity()
                                          }
                                        }}
                                        min="1"
                                        autoFocus
                                        className={`w-14 md:w-16 px-1.5 md:px-2 py-1 rounded border text-xs ${
                                          darkMode
                                            ? 'bg-slate-900 border-blue-500 text-white'
                                            : 'bg-white border-blue-500 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                                      />
                                      <button
                                        onClick={() => updateQuantity(item._id)}
                                        className={`px-2 py-1 rounded font-medium text-xs ${
                                          darkMode
                                            ? 'bg-green-600 hover:bg-green-500 text-white'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={cancelEditingQuantity}
                                        className={`px-2 py-1 rounded font-medium text-xs ${
                                          darkMode
                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startEditingQuantity(item._id, item.quantity)}
                                      className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-medium transition-all text-xs ${
                                        darkMode
                                          ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50'
                                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                      }`}
                                    >
                                      Qty: {item.quantity}
                                    </button>
                                  )}
                                </div>
                                {/* Comment display if exists and not editing */}
                                {item.comment && editingComment !== item._id && (
                                  <div className={`mt-2 text-xs italic ${
                                    darkMode ? 'text-slate-400' : 'text-gray-500'
                                  }`}>
                                    💬 {item.comment}
                                  </div>
                                )}

                                {/* Comment field - expanded when editing */}
                                {editingComment === item._id && (
                                  <div className="mt-3 w-full animate-slide-up">
                                    <textarea
                                      value={editCommentValue}
                                      onChange={(e) => setEditCommentValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault()
                                          updateComment(item._id)
                                        } else if (e.key === 'Escape') {
                                          cancelEditingComment()
                                        }
                                      }}
                                      onBlur={() => updateComment(item._id)}
                                      placeholder="Add a note (brand, size, location...)"
                                      autoFocus
                                      rows={2}
                                      className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                                        darkMode
                                          ? 'bg-slate-900 border-blue-500 text-white placeholder-slate-500'
                                          : 'bg-white border-blue-500 text-gray-900 placeholder-gray-400'
                                      } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => updateComment(item._id)}
                                        className={`px-3 py-1.5 rounded-lg font-medium text-xs ${
                                          darkMode
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelEditingComment}
                                        className={`px-3 py-1.5 rounded-lg font-medium text-xs ${
                                          darkMode
                                            ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                        }`}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2 flex-shrink-0">
                                {/* Comment button */}
                                <button
                                  onClick={() => startEditingComment(item._id, item.comment)}
                                  className={`p-1.5 md:p-2 rounded-lg font-medium transition-all duration-300 text-sm ${
                                    item.comment
                                      ? darkMode
                                        ? 'text-blue-400 bg-blue-900/20 hover:bg-blue-900/30'
                                        : 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                      : darkMode
                                        ? 'text-slate-400 hover:bg-slate-800'
                                        : 'text-gray-400 hover:bg-gray-100'
                                  }`}
                                  title={item.comment ? 'Edit comment' : 'Add comment'}
                                >
                                  💬
                                </button>

                                {/* Delete button */}
                                <button
                                  onClick={() => deleteItem(item._id)}
                                  className={`p-1.5 md:p-2 rounded-lg font-medium transition-all duration-300 text-sm ${
                                    darkMode
                                      ? 'text-red-400 hover:bg-red-900/20'
                                      : 'text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  ✕
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
