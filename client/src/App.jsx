import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');

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
        title: input
      });
      setTasks([...tasks, response.data]); // Add the new task to the list
      setInput(''); // Clear the input field
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

  // 5. Delete a task
  const deleteTask = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/tasks/${id}`);
      setTasks(tasks.filter(task => task._id !== id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="futuristic-bg">
      <h1 className="futuristic-title animate-glow">Perry ToDo List</h1>
      <div className="input-container animate-fade-in">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What needs to be done?"
          className="futuristic-input"
        />
        <button onClick={addTask} className="futuristic-btn">
          Add Task
        </button>
      </div>
      {tasks.length > 0 && (
        <button onClick={deleteAll} className="delete-all-btn">
          Delete All
        </button>
      )}
      <ul className="task-list animate-slide-up">
        {tasks.map(task => (
          <li key={task._id} className={`task-item ${task.completed ? 'completed' : ''}`}>
            <input 
              type="checkbox" 
              checked={task.completed} 
              onChange={() => toggleComplete(task._id, task.completed)}
              className="task-checkbox"
            />
            <span className={`task-title ${task.completed ? 'completed-text' : ''}`}>{task.title}</span>
            <button onClick={() => deleteTask(task._id)} className="delete-btn animate-pop">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App