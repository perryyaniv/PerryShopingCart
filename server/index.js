const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('👋 Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ Connection error:', err));

// Shopping Item Schema
const shoppingItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        default: 1
    },
    category: {
        type: String,
        default: 'general'
    },
    purchased: {
        type: Boolean,
        default: false
    },
    addedBy: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    purchasedAt: {
        type: Date,
        default: null
    }
});

// Active Shopping List Schema
const activeListSchema = new mongoose.Schema({
    items: [shoppingItemSchema],
    createdAt: { 
        type: Date, 
        default: Date.now
    },
    lastModified: {
        type: Date,
        default: Date.now
    }
});

// History Entry Schema
const historyEntrySchema = new mongoose.Schema({
    items: [shoppingItemSchema],
    completedAt: { 
        type: Date, 
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Models
const ActiveList = mongoose.model('ActiveList', activeListSchema);
const HistoryEntry = mongoose.model('HistoryEntry', historyEntrySchema);

// Initialize active list if it doesn't exist
async function initializeActiveList() {
    const count = await ActiveList.countDocuments();
    if (count === 0) {
        await ActiveList.create({ items: [] });
    }
}

initializeActiveList();

// Track recently archived items to prevent duplicates
const recentlyArchived = new Map();

// Helper function to archive individual items
async function archiveIndividualItem(item) {
    try {
        // Use only item name as key (case-insensitive) to prevent duplicate names
        const itemKey = item.name.toLowerCase();
        const now = Date.now();

        // Check if an item with this name was recently archived (within last 5 seconds)
        if (recentlyArchived.has(itemKey)) {
            const lastArchived = recentlyArchived.get(itemKey);
            if (now - lastArchived < 5000) {
                console.log('⚠️  Skipping duplicate archive for:', item.name, '(archived', Math.round((now - lastArchived) / 1000), 'seconds ago)');
                return;
            }
        }

        console.log('📦 Archiving item:', item.name);
        // Create a history entry with just this one item
        const historyEntry = await HistoryEntry.create({
            items: [item],
            completedAt: new Date()
        });
        console.log('✅ Item archived successfully:', historyEntry._id);

        // Mark as recently archived
        recentlyArchived.set(itemKey, now);
        console.log('🔐 Locked:', itemKey, 'for 5 seconds');

        // Clean up old entries after 10 seconds
        setTimeout(() => {
            recentlyArchived.delete(itemKey);
            console.log('🔓 Unlocked:', itemKey);
        }, 10000);
    } catch (err) {
        console.error('❌ Error archiving item:', err);
    }
}

// Get active shopping list
app.get('/list/active', async (req, res) => {
    try {
        let list = await ActiveList.findOne();
        if (!list) {
            list = await ActiveList.create({ items: [] });
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get history entries
app.get('/list/history', async (req, res) => {
    try {
        const history = await HistoryEntry.find().sort({ completedAt: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add item to active list
app.post('/list/active/items', async (req, res) => {
    try {
        const list = await ActiveList.findOne();
        
        if (!list) {
            return res.status(404).json({ message: "Active list not found" });
        }
        
        const newItem = {
            _id: new mongoose.Types.ObjectId(),
            name: req.body.name,
            quantity: req.body.quantity || 1,
            category: req.body.category || 'general',
            addedBy: req.body.addedBy,
            comment: req.body.comment || '',
            purchased: false,
            createdAt: new Date(),
            purchasedAt: null
        };

        list.items.push(newItem);
        list.lastModified = new Date();
        const updatedList = await list.save();

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('list-updated', { activeList: updatedList });

        res.status(201).json(updatedList);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update item in active list (or archive and delete when purchased)
app.patch('/list/active/items/:itemId', async (req, res) => {
    try {
        const list = await ActiveList.findOne();

        if (!list) {
            return res.status(404).json({ message: "Active list not found" });
        }

        const item = list.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        if (req.body.name !== undefined) item.name = req.body.name;
        if (req.body.quantity !== undefined) item.quantity = req.body.quantity;
        if (req.body.category !== undefined) item.category = req.body.category;
        if (req.body.comment !== undefined) item.comment = req.body.comment;
        if (req.body.purchased !== undefined) {
            // If marking as purchased, archive it and remove from active list
            if (req.body.purchased === true && !item.purchased) {
                await archiveIndividualItem(item.toObject());
                item.deleteOne();
                list.lastModified = new Date();
                const updatedList = await list.save();

                // Emit updates to all clients
                const io = req.app.get('io');
                io.emit('list-updated', { activeList: updatedList });
                // Also fetch and emit updated history
                const history = await HistoryEntry.find().sort({ completedAt: -1 });
                io.emit('history-updated', { history });

                return res.json(updatedList);
            }
            item.purchased = req.body.purchased;
            item.purchasedAt = req.body.purchased ? new Date() : null;
        }

        list.lastModified = new Date();
        const updatedList = await list.save();

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete item from active list
app.delete('/list/active/items/:itemId', async (req, res) => {
    try {
        const list = await ActiveList.findOne();

        if (!list) {
            return res.status(404).json({ message: "Active list not found" });
        }

        const item = list.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // Just delete without archiving
        item.deleteOne();
        list.lastModified = new Date();
        const updatedList = await list.save();

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Copy items from history entry to active list
app.post('/list/copy-from-history/:historyId', async (req, res) => {
    try {
        const activeList = await ActiveList.findOne();
        const historyEntry = await HistoryEntry.findById(req.params.historyId);
        
        if (!activeList) {
            return res.status(404).json({ message: "Active list not found" });
        }
        
        if (!historyEntry) {
            return res.status(404).json({ message: "History entry not found" });
        }
        
        historyEntry.items.forEach(item => {
            const copiedItem = {
                _id: new mongoose.Types.ObjectId(),
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                addedBy: 'imported',
                purchased: false,
                createdAt: new Date(),
                purchasedAt: null
            };
            activeList.items.push(copiedItem);
        });
        
        activeList.lastModified = new Date();
        const updatedList = await activeList.save();
        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Archive active list (move to history)
app.post('/list/archive', async (req, res) => {
    try {
        const activeList = await ActiveList.findOne();
        
        if (!activeList || activeList.items.length === 0) {
            return res.status(400).json({ message: "Nothing to archive" });
        }
        
        // Create history entry
        await HistoryEntry.create({
            items: activeList.items,
            completedAt: new Date()
        });
        
        // Clear active list
        activeList.items = [];
        activeList.lastModified = new Date();
        await activeList.save();
        
        res.json({ message: "List archived successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Clear active list
app.post('/list/clear', async (req, res) => {
    try {
        const activeList = await ActiveList.findOne();
        activeList.items = [];
        activeList.lastModified = new Date();
        const updatedList = await activeList.save();

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Restore purchased item to active list (for undo)
app.post('/list/restore-item', async (req, res) => {
    try {
        const list = await ActiveList.findOne();

        if (!list) {
            return res.status(404).json({ message: "Active list not found" });
        }

        const newItem = {
            _id: new mongoose.Types.ObjectId(),
            name: req.body.name,
            quantity: req.body.quantity || 1,
            category: req.body.category || 'general',
            addedBy: req.body.addedBy,
            comment: req.body.comment || '',
            purchased: false,
            createdAt: new Date(),
            purchasedAt: null
        };

        list.items.push(newItem);
        list.lastModified = new Date();
        const updatedList = await list.save();

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('list-updated', { activeList: updatedList });

        res.status(201).json(updatedList);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a specific history entry
app.delete('/list/history/:historyId', async (req, res) => {
    try {
        await HistoryEntry.findByIdAndDelete(req.params.historyId);
        const history = await HistoryEntry.find().sort({ completedAt: -1 });

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('history-updated', { history });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a specific item from a history entry
app.delete('/list/history/:historyId/items/:itemId', async (req, res) => {
    try {
        const historyEntry = await HistoryEntry.findById(req.params.historyId);
        if (!historyEntry) {
            return res.status(404).json({ message: "History entry not found" });
        }

        historyEntry.items.id(req.params.itemId).deleteOne();
        const updated = await historyEntry.save();

        const history = await HistoryEntry.find().sort({ completedAt: -1 });

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('history-updated', { history });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Clear all history
app.delete('/list/history', async (req, res) => {
    try {
        await HistoryEntry.deleteMany({});

        // Emit to all clients
        const io = req.app.get('io');
        io.emit('history-updated', { history: [] });

        res.json({ message: "All history cleared" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('Perry Shopping Cart Server is running!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server is flying on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
});