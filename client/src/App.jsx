import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [activeList, setActiveList] = useState(null)
  const [historyList, setHistoryList] = useState([])
  const [itemName, setItemName] = useState('')
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemCategory, setItemCategory] = useState('General')
  const [darkMode, setDarkMode] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('active')
  const [pastUsers, setPastUsers] = useState([])
  const [processingItems, setProcessingItems] = useState(new Set())
  const processingRef = useRef(new Set())

  // Fetch active list and past users on mount
  useEffect(() => {
    fetchActiveList()
    fetchHistory()
    const saved = localStorage.getItem('pastUsers')
    if (saved) {
      const users = JSON.parse(saved)
      setPastUsers(users)
      // Set first user as default
      if (users.length > 0 && !userName) {
        setUserName(users[0])
      }
    }
  }, [])

  const fetchActiveList = async () => {
    try {
      const response = await axios.get('http://localhost:5000/list/active')
      setActiveList(response.data)
    } catch (error) {
      console.error('Error fetching list:', error)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:5000/list/history')
      setHistoryList(response.data)
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  const handleLoginUser = () => {
    if (userName.trim()) {
      const trimmedName = userName.trim()
      setCurrentUser(trimmedName)
      setUserName('')
      
      // Save to past users if not already there
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

  const addItem = async () => {
    if (!itemName.trim() || !currentUser) return

    try {
      const trimmedName = itemName.trim()
      
      // Check if item already exists (case-insensitive)
      const existingItem = activeList?.items.find(
        item => item.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (existingItem) {
        // Show alert that item is already in the list
        alert(`"${existingItem.name}" is already in your shopping list!`)
        return
      }

      // Add new item
      const newItem = {
        name: trimmedName,
        quantity: parseInt(itemQuantity),
        category: itemCategory,
        addedBy: currentUser
      }

      const response = await axios.post('http://localhost:5000/list/active/items', newItem)
      setActiveList(response.data)

      setItemName('')
      setItemQuantity(1)
      setItemCategory('General')
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const togglePurchased = async (itemId) => {
    // Use ref for immediate synchronous check
    if (!activeList || processingRef.current.has(itemId)) {
      console.log('Already processing:', itemId)
      return
    }

    // Mark this item as being processed (synchronously)
    console.log('Processing item:', itemId)
    processingRef.current.add(itemId)
    setProcessingItems(prev => new Set(prev).add(itemId))

    try {
      // Mark as purchased - server will archive and remove it
      const response = await axios.patch(
        `http://localhost:5000/list/active/items/${itemId}`,
        { purchased: true }
      )
      setActiveList(response.data)
      // Refresh history to show newly archived item
      await fetchHistory()
    } catch (error) {
      console.error('Error marking item as purchased:', error)
    } finally {
      // Remove from processing set
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
      const response = await axios.delete(
        `http://localhost:5000/list/active/items/${itemId}`
      )
      setActiveList(response.data)
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const copyFromHistory = async (historyId) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/list/copy-from-history/${historyId}`
      )
      setActiveList(response.data)
      setActiveTab('active')
    } catch (error) {
      console.error('Error copying from history:', error)
    }
  }

  const addItemFromHistory = async (historyItem) => {
    try {
      const trimmedName = historyItem.name.trim()
      
      // Check if item already exists in active list (case-insensitive)
      const existingItem = activeList?.items.find(
        item => item.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (existingItem) {
        alert(`"${existingItem.name}" is already in your shopping list!`)
        return
      }

      // Add the history item to active list
      const newItem = {
        name: trimmedName,
        quantity: historyItem.quantity,
        category: historyItem.category,
        addedBy: currentUser
      }

      const response = await axios.post('http://localhost:5000/list/active/items', newItem)
      setActiveList(response.data)
    } catch (error) {
      console.error('Error adding item from history:', error)
    }
  }

  const archiveList = async () => {
    try {
      await axios.post('http://localhost:5000/list/archive')
      fetchActiveList()
      fetchHistory()
    } catch (error) {
      console.error('Error archiving list:', error)
    }
  }

  const clearList = async () => {
    if (window.confirm('Clear the entire list?')) {
      try {
        const response = await axios.post('http://localhost:5000/list/clear')
        setActiveList(response.data)
      } catch (error) {
        console.error('Error clearing list:', error)
      }
    }
  }

  const deleteHistoryEntry = async (historyId) => {
    if (window.confirm('Delete this shopping list from history?')) {
      try {
        const response = await axios.delete(`http://localhost:5000/list/history/${historyId}`)
        setHistoryList(response.data)
      } catch (error) {
        console.error('Error deleting history entry:', error)
      }
    }
  }

  const deleteHistoryItem = async (historyId, itemId) => {
    try {
      const response = await axios.delete(
        `http://localhost:5000/list/history/${historyId}/items/${itemId}`
      )
      setHistoryList(response.data)
    } catch (error) {
      console.error('Error deleting history item:', error)
    }
  }

  const clearAllHistory = async () => {
    if (window.confirm('Delete ALL shopping history? This cannot be undone.')) {
      try {
        await axios.delete('http://localhost:5000/list/history')
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

  // Check if item name already exists in active list
  const itemExists = activeList?.items.some(
    item => item.name.toLowerCase() === itemName.trim().toLowerCase()
  ) && itemName.trim() !== ''

  if (!currentUser) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center ${
          darkMode ? 'bg-slate-950' : 'bg-gray-50'
        }`}>
          <div className={`w-full max-w-md p-8 rounded-xl border transition-colors duration-300 ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Perry Shopping Cart
            </h1>
            <p className={`mb-6 text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
              Enter your name to get started
            </p>

            <div className="space-y-4">
              {pastUsers.length > 0 ? (
                <>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLoginUser()}
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
                  onKeyPress={(e) => e.key === 'Enter' && handleLoginUser()}
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
                className={`w-full px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                  darkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              >
                Log In
              </button>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`absolute top-6 right-6 p-2.5 rounded-lg transition-all duration-300 ${
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

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 border-b transition-colors duration-300 ${
          darkMode
            ? 'bg-slate-900/95 backdrop-blur border-slate-800'
            : 'bg-white/95 backdrop-blur border-gray-200'
        }`}>
          <div className="max-w-4xl mx-auto px-6 py-5 flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Perry Shopping Cart</h1>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Welcome, {currentUser}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-lg transition-all duration-300 ${
                  darkMode
                    ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <button
                onClick={handleLogout}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
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

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Stats Card */}
          <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  Items to Buy
                </p>
                <p className={`text-3xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {pendingCount}
                </p>
              </div>
              <div className={`text-4xl ${pendingCount === 0 ? 'opacity-100' : 'opacity-50'}`}>
                {pendingCount === 0 ? '✓' : '→'}
              </div>
            </div>
          </div>

          {/* Add Item Section */}
          <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Add New Item
            </h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !itemExists && addItem()}
                  placeholder="Item name"
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
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

              <input
                type="number"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                min="1"
                placeholder="Qty"
                className={`w-20 px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              />

              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className={`px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
                } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
              >
                <option value="General">General</option>
                <option value="Fruits & Vegetables">Fruits & Vegetables</option>
                <option value="Bakery">Bakery</option>
                <option value="Dairy">Dairy</option>
                <option value="Meat">Meat</option>
                <option value="Frozen">Frozen</option>
                <option value="Pantry">Pantry</option>
              </select>

              <button
                onClick={addItem}
                disabled={itemExists}
                className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
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
          <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-300 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 ${
                  activeTab === 'active'
                    ? darkMode
                      ? 'border-blue-500 text-blue-400'
                      : 'border-blue-600 text-blue-600'
                    : darkMode
                      ? 'border-transparent text-slate-400 hover:text-slate-300'
                      : 'border-transparent text-gray-500 hover:text-gray-600'
                }`}
              >
                Active List
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 ${
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
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm mb-4 ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => archiveList()}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                      darkMode
                        ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    Archive List
                  </button>

                  <button
                    onClick={() => clearList()}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
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
          </div>

          {/* History Tab Content */}
          {activeTab === 'history' && (
            <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Archived Items
                </h2>
                {historyList.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                      darkMode
                        ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {historyList.length === 0 ? (
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  No archived items found
                </p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // Flatten all items and deduplicate by name (keep most recent)
                    const allItems = historyList.flatMap((entry) =>
                      entry.items.map((item) => ({
                        ...item,
                        entryId: entry._id,
                        completedAt: entry.completedAt
                      }))
                    )

                    // Deduplicate by name (case-insensitive), keeping most recent
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

                    // Sort by most recent first
                    uniqueItems.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))

                    return uniqueItems.map((item) => {
                      const existsInActiveList = activeList?.items.some(
                        activeItem => activeItem.name.toLowerCase() === item.name.toLowerCase()
                      )
                      return (
                        <div
                          key={`${item.entryId}-${item._id}`}
                          className={`p-3 rounded-lg border flex items-center justify-between group ${
                            darkMode
                              ? 'bg-slate-800 border-slate-700 hover:border-blue-500'
                              : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                          } transition-all`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
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
                            <div className="flex flex-wrap gap-2 mt-1 text-xs">
                              <span className={`px-2 py-1 rounded ${
                                darkMode
                                  ? 'bg-blue-900/30 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                Qty: {item.quantity}
                              </span>
                              <span className={`px-2 py-1 rounded ${
                                darkMode
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-gray-200 text-gray-700'
                              }`}>
                                {item.category}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
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
                          <div className="flex gap-2 ml-3">
                            <button
                              onClick={() => addItemFromHistory(item)}
                              disabled={existsInActiveList}
                              className={`px-3 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all duration-300 ${
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
                              className={`px-2 py-2 rounded-lg font-medium text-xs transition-all duration-300 ${
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
            <div className={`text-center py-16 rounded-xl border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-gray-200'
            }`}>
              <p className={`text-base font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {searchQuery
                  ? 'No items match your criteria'
                  : 'No items yet. Add one to get started'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredItems.map(item => (
                <li
                  key={item._id}
                  className={`group p-4 rounded-lg transition-all duration-300 border flex items-start gap-4 ${
                    darkMode
                      ? `${
                          item.purchased
                            ? 'bg-slate-900/50 border-slate-700'
                            : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'
                        }`
                      : `${
                          item.purchased
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-white border-gray-200 hover:border-blue-400'
                        }`
                  } hover:shadow-sm`}
                >
                  <input
                    type="checkbox"
                    checked={item.purchased}
                    onChange={() => togglePurchased(item._id)}
                    disabled={processingItems.has(item._id)}
                    className={`mt-1.5 w-5 h-5 rounded border-gray-300 accent-blue-600 flex-shrink-0 ${
                      processingItems.has(item._id) ? 'cursor-wait opacity-50' : 'cursor-pointer'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium transition-all duration-300 break-words ${
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

                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-full font-medium ${
                          darkMode
                            ? 'bg-blue-900/30 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        Qty: {item.quantity}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full font-medium ${
                          darkMode
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteItem(item._id)}
                    className={`flex-shrink-0 p-2 rounded-lg font-medium transition-all duration-300 text-sm ${
                      darkMode
                        ? 'text-red-400 hover:bg-red-900/20'
                        : 'text-red-600 hover:bg-red-100'
                    }`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App