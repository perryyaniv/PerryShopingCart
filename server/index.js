const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Base settings
app.use(cors());
app.use(express.json()); // Enables the server to read JSON that is sent to it

// Ccnnect MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Connection error:', err));

// 1. Create a Schema (The template for a task)
const taskSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true // A task must have a title
    },
    completed: { 
        type: Boolean, 
        default: false // By default, a new task is not completed
    },
    priority: {
        type: String,
        enum: ['normal', 'urgent'],
        default: 'normal' // Priority level: normal (yellow), urgent (red)
    },
    dueDate: {
        type: Date,
        default: null // Optional due date for the task
    },
    createdAt: { 
        type: Date, 
        default: Date.now // Automatically record when the task was created
    },
    completedAt: { 
        type: Date, 
        default: null // Timestamp for when the task was marked as completed
    }
});

// 2. Create a Model (The tool to interact with the "Tasks" collection)
const Task = mongoose.model('Task', taskSchema);

// Route to add a new task
app.post('/tasks', async (req, res) => {
    try {
        const newTask = new Task({
            title: req.body.title,
            priority: req.body.priority || 'normal',
            dueDate: req.body.dueDate || null
        });
        
        const savedTask = await newTask.save(); // Save to MongoDB Atlas
        res.status(201).json(savedTask); // Send back the saved task with its ID
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Route to get all tasks
app.get('/tasks', async (req, res) => {
    try {
        // Task.find() looks into your MongoDB collection and returns everything
        const tasks = await Task.find(); 
        res.json(tasks); // Send the array of tasks back to the user
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to update a task's completion status, title, priority, or due date
app.patch('/tasks/:id', async (req, res) => {
    try {
        const updateData = {};
        
        if (req.body.completed !== undefined) {
            updateData.completed = req.body.completed;
            // Set completedAt timestamp when task is marked as completed
            updateData.completedAt = req.body.completed ? new Date() : null;
        }
        
        if (req.body.title !== undefined) {
            updateData.title = req.body.title;
        }
        
        if (req.body.priority !== undefined) {
            updateData.priority = req.body.priority;
        }
        
        if (req.body.dueDate !== undefined) {
            updateData.dueDate = req.body.dueDate;
        }
        
        const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
        
        if (!updatedTask) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to delete a task by its ID
app.delete('/tasks/:id', async (req, res) => {
    try {
        const deletedTask = await Task.findByIdAndDelete(req.params.id);
        
        if (!deletedTask) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        res.json({ message: "Task deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Check the server is up
app.get('/', (req, res) => {
    res.send('Server is up and running!');
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is flying on http://localhost:${PORT}`);
});