import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [darkMode, setDarkMode] = useState(false);

  // Helper function to check if task is overdue
  const isOverdue = (dueDate, completed) => {
    if (!dueDate || completed) return false;
    return new Date(dueDate) < new Date();
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Filter tasks based on search query and status
  const getFilteredTasks = () => {
    let filtered = tasks;

    // Filter by status
    if (filterStatus === 'completed') {
      filtered = filtered.filter(task => task.completed);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(task => !task.completed);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  // Get the count of pending tasks
  const pendingCount = tasks.filter(task => !task.completed).length;
  const filteredTasks = getFilteredTasks();

  // 1. Fetch tasks when the component mounts
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://localhost:5000/tasks');
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  // 2. Add a new task
  const addTask = async () => {
    if (!input) return; // Don't add empty tasks
    try {
      const response = await axios.post('http://localhost:5000/tasks', {
        title: input,
        priority: priority,
        dueDate: dueDate || null
      });
      setTasks([...tasks, response.data]); // Add the new task to the list
      setInput(''); // Clear the input field
      setPriority('normal'); // Reset priority
      setDueDate(''); // Reset due date
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // 3. Toggle task completion status
  const toggleComplete = async (id, currentStatus) => {
    try {
      const response = await axios.patch(`http://localhost:5000/tasks/${id}`, {
        completed: !currentStatus
      });
      setTasks(tasks.map(task => task._id === id ? response.data : task));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  // 4. Delete all tasks
  const deleteAll = async () => {
    if (tasks.length === 0) return;
    if (!confirm('Are you sure you want to delete ALL tasks?')) return;
    try {
      await Promise.all(tasks.map(task => axios.delete(`http://localhost:5000/tasks/${task._id}`)));
      setTasks([]);
    } catch (error) {
      console.error("Error deleting all tasks:", error);
    }
  };

  // 5. Update task title
  const updateTaskTitle = async (id, newTitle) => {
    if (!newTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const response = await axios.patch(`http://localhost:5000/tasks/${id}`, {
        title: newTitle
      });
      setTasks(tasks.map(task => task._id === id ? response.data : task));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating task title:", error);
    }
  };

  // 6. Delete a task
  const deleteTask = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/tasks/${id}`);
      setTasks(tasks.filter(task => task._id !== id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Task Manager</h1>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Organize your work efficiently
              </p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-lg transition-all duration-300 ${
                darkMode
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Toggle Dark Mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
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
                  Tasks to Complete
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

          {/* Input Section */}
          <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Add New Task
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="What needs to be done?"
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                } focus:outline-none focus:ring-4`}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`px-4 py-3 rounded-lg border transition-all duration-300 text-sm font-medium ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  } focus:outline-none focus:ring-4`}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="urgent">High Priority</option>
                </select>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`px-4 py-3 rounded-lg border transition-all duration-300 text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-500/20 [color-scheme:dark]'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  } focus:outline-none focus:ring-4`}
                />

                <button
                  onClick={addTask}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 transform ${
                    darkMode
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500/30`}
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className={`mb-8 p-6 rounded-xl transition-colors duration-300 border ${
            darkMode
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-gray-200'
          }`}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className={`w-full px-4 py-3 rounded-lg border transition-all duration-300 text-sm mb-4 ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
              } focus:outline-none focus:ring-4`}
            />

            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : darkMode
                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status === 'all' && 'All Tasks'}
                  {status === 'pending' && 'Pending'}
                  {status === 'completed' && 'Completed'}
                </button>
              ))}

              {tasks.length > 0 && (
                <button
                  onClick={deleteAll}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ml-auto ${
                    darkMode
                      ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  Delete All
                </button>
              )}
            </div>
          </div>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <div className={`text-center py-16 rounded-xl border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-gray-200'
            }`}>
              <p className={`text-base font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {searchQuery || filterStatus !== 'all'
                  ? 'No tasks match your criteria'
                  : 'No tasks yet. Create one to get started'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredTasks.map(task => (
                <li
                  key={task._id}
                  className={`group p-4 rounded-lg transition-all duration-300 border flex items-start gap-4 ${
                    darkMode
                      ? `${
                          task.completed
                            ? 'bg-slate-900/50 border-slate-700'
                            : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'
                          }`
                      : `${
                          task.completed
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-white border-gray-200 hover:border-blue-400'
                        }`
                  } ${task.priority === 'urgent' && !task.completed ? (darkMode ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-red-500') : ''} ${
                    isOverdue(task.dueDate, task.completed) && !task.completed ? (darkMode ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-amber-500') : ''
                  } hover:shadow-sm`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleComplete(task._id, task.completed)}
                    className="mt-1.5 w-5 h-5 rounded border-gray-300 cursor-pointer accent-blue-600 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    {editingId === task._id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => updateTaskTitle(task._id, editingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateTaskTitle(task._id, editingTitle);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className={`w-full px-3 py-2 rounded-lg border transition-all duration-300 text-sm ${
                          darkMode
                            ? 'bg-slate-800 border-blue-500 text-white focus:ring-blue-500/20'
                            : 'bg-white border-blue-500 text-gray-900 focus:ring-blue-500/20'
                        } focus:outline-none focus:ring-4`}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingId(task._id);
                          setEditingTitle(task.title);
                        }}
                        className={`block text-sm font-medium transition-all duration-300 break-words cursor-pointer ${
                          task.completed
                            ? darkMode
                              ? 'text-slate-500 line-through'
                              : 'text-gray-400 line-through'
                            : darkMode
                              ? 'text-white hover:text-blue-400'
                              : 'text-gray-900 hover:text-blue-600'
                        }`}
                      >
                        {task.title}
                        {isOverdue(task.dueDate, task.completed) && ' ⚠'}
                      </span>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      {task.priority === 'urgent' && (
                        <span className={`px-2.5 py-1 rounded-full font-medium ${
                          darkMode 
                            ? 'bg-red-900/30 text-red-300' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          High Priority
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`px-2.5 py-1 rounded-full font-medium ${
                          isOverdue(task.dueDate, task.completed)
                            ? darkMode
                              ? 'bg-amber-900/30 text-amber-300'
                              : 'bg-amber-100 text-amber-700'
                            : darkMode
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTask(task._id)}
                    className={`flex-shrink-0 p-2 rounded-lg font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 text-sm ${
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
          )}
        </div>
      </div>
    </div>
  )
}

export default App