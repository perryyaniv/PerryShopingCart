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

  socket.on('join-cart', (cartId) => {
    socket.join(cartId);
    console.log(`🛒 Socket ${socket.id} joined cart: ${cartId}`);
  });

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

// Cart Schema (group of users sharing a list)
const cartSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Active Shopping List Schema
const activeListSchema = new mongoose.Schema({
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true
    },
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
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true
    },
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
const Cart = mongoose.model('Cart', cartSchema);
const ActiveList = mongoose.model('ActiveList', activeListSchema);
const HistoryEntry = mongoose.model('HistoryEntry', historyEntrySchema);

// Seed default PerryCart and migrate existing data
async function seedAndMigrate() {
    let defaultCart = await Cart.findOne({ code: 'perrycart' });
    if (!defaultCart) {
        defaultCart = await Cart.create({ name: 'PerryCart', code: 'perrycart' });
        console.log('✅ Created default cart: PerryCart');
    }

    const migratedLists = await ActiveList.updateMany(
        { cartId: { $exists: false } },
        { $set: { cartId: defaultCart._id } }
    );
    if (migratedLists.modifiedCount > 0) {
        console.log(`✅ Migrated ${migratedLists.modifiedCount} active list(s) to PerryCart`);
    }

    const migratedHistory = await HistoryEntry.updateMany(
        { cartId: { $exists: false } },
        { $set: { cartId: defaultCart._id } }
    );
    if (migratedHistory.modifiedCount > 0) {
        console.log(`✅ Migrated ${migratedHistory.modifiedCount} history entries to PerryCart`);
    }

    const count = await ActiveList.countDocuments({ cartId: defaultCart._id });
    if (count === 0) {
        await ActiveList.create({ cartId: defaultCart._id, items: [] });
        console.log('✅ Created empty active list for PerryCart');
    }
}

seedAndMigrate();

// Track recently archived items to prevent duplicates (keyed by cartId:itemName)
const recentlyArchived = new Map();

// Helper function to archive individual items
async function archiveIndividualItem(item, cartId) {
    try {
        const itemKey = `${cartId}:${item.name.toLowerCase()}`;
        const now = Date.now();

        if (recentlyArchived.has(itemKey)) {
            const lastArchived = recentlyArchived.get(itemKey);
            if (now - lastArchived < 5000) {
                console.log('⚠️  Skipping duplicate archive for:', item.name, '(archived', Math.round((now - lastArchived) / 1000), 'seconds ago)');
                return;
            }
        }

        console.log('📦 Archiving item:', item.name);
        const historyEntry = await HistoryEntry.create({
            cartId,
            items: [item],
            completedAt: new Date()
        });
        console.log('✅ Item archived successfully:', historyEntry._id);

        recentlyArchived.set(itemKey, now);
        console.log('🔐 Locked:', itemKey, 'for 5 seconds');

        setTimeout(() => {
            recentlyArchived.delete(itemKey);
            console.log('🔓 Unlocked:', itemKey);
        }, 10000);
    } catch (err) {
        console.error('❌ Error archiving item:', err);
    }
}

// Middleware to validate cartId
async function resolveCart(req, res, next) {
    try {
        const cart = await Cart.findById(req.params.cartId);
        if (!cart) return res.status(404).json({ message: 'Cart not found' });
        req.cart = cart;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid cart ID' });
    }
}

// --- Cart Routes ---

// Create a new cart
app.post('/cart', async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name || !code) {
            return res.status(400).json({ message: 'Name and code are required' });
        }

        const existing = await Cart.findOne({ code: code.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ message: 'A cart with this code already exists' });
        }

        const cart = await Cart.create({ name: name.trim(), code: code.toLowerCase().trim() });
        await ActiveList.create({ cartId: cart._id, items: [] });

        res.status(201).json(cart);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Join a cart by code
app.post('/cart/join', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ message: 'Code is required' });

        const cart = await Cart.findOne({ code: code.toLowerCase().trim() });
        if (!cart) return res.status(404).json({ message: 'No cart found with this code' });

        res.json(cart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- List Routes (scoped to cart) ---

// Get active shopping list
app.get('/cart/:cartId/list/active', resolveCart, async (req, res) => {
    try {
        let list = await ActiveList.findOne({ cartId: req.params.cartId });
        if (!list) {
            list = await ActiveList.create({ cartId: req.params.cartId, items: [] });
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get history entries
app.get('/cart/:cartId/list/history', resolveCart, async (req, res) => {
    try {
        const history = await HistoryEntry.find({ cartId: req.params.cartId }).sort({ completedAt: -1 });
        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add item to active list
app.post('/cart/:cartId/list/active/items', resolveCart, async (req, res) => {
    try {
        const list = await ActiveList.findOne({ cartId: req.params.cartId });

        if (!list) {
            return res.status(404).json({ message: 'Active list not found' });
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

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });

        res.status(201).json(updatedList);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update item in active list (or archive and delete when purchased)
app.patch('/cart/:cartId/list/active/items/:itemId', resolveCart, async (req, res) => {
    try {
        const list = await ActiveList.findOne({ cartId: req.params.cartId });

        if (!list) {
            return res.status(404).json({ message: 'Active list not found' });
        }

        const item = list.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (req.body.name !== undefined) item.name = req.body.name;
        if (req.body.quantity !== undefined) item.quantity = req.body.quantity;
        if (req.body.category !== undefined) item.category = req.body.category;
        if (req.body.comment !== undefined) item.comment = req.body.comment;
        if (req.body.purchased !== undefined) {
            if (req.body.purchased === true && !item.purchased) {
                await archiveIndividualItem(item.toObject(), req.params.cartId);
                item.deleteOne();
                list.lastModified = new Date();
                const updatedList = await list.save();

                const io = req.app.get('io');
                io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });
                const history = await HistoryEntry.find({ cartId: req.params.cartId }).sort({ completedAt: -1 });
                io.to(req.params.cartId).emit('history-updated', { history });

                return res.json(updatedList);
            }
            item.purchased = req.body.purchased;
            item.purchasedAt = req.body.purchased ? new Date() : null;
        }

        list.lastModified = new Date();
        const updatedList = await list.save();

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete item from active list
app.delete('/cart/:cartId/list/active/items/:itemId', resolveCart, async (req, res) => {
    try {
        const list = await ActiveList.findOne({ cartId: req.params.cartId });

        if (!list) {
            return res.status(404).json({ message: 'Active list not found' });
        }

        const item = list.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        item.deleteOne();
        list.lastModified = new Date();
        const updatedList = await list.save();

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Copy items from history entry to active list
app.post('/cart/:cartId/list/copy-from-history/:historyId', resolveCart, async (req, res) => {
    try {
        const activeList = await ActiveList.findOne({ cartId: req.params.cartId });
        const historyEntry = await HistoryEntry.findById(req.params.historyId);

        if (!activeList) {
            return res.status(404).json({ message: 'Active list not found' });
        }

        if (!historyEntry) {
            return res.status(404).json({ message: 'History entry not found' });
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
app.post('/cart/:cartId/list/archive', resolveCart, async (req, res) => {
    try {
        const activeList = await ActiveList.findOne({ cartId: req.params.cartId });

        if (!activeList || activeList.items.length === 0) {
            return res.status(400).json({ message: 'Nothing to archive' });
        }

        await HistoryEntry.create({
            cartId: req.params.cartId,
            items: activeList.items,
            completedAt: new Date()
        });

        activeList.items = [];
        activeList.lastModified = new Date();
        await activeList.save();

        res.json({ message: 'List archived successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Clear active list
app.post('/cart/:cartId/list/clear', resolveCart, async (req, res) => {
    try {
        const activeList = await ActiveList.findOne({ cartId: req.params.cartId });
        activeList.items = [];
        activeList.lastModified = new Date();
        const updatedList = await activeList.save();

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });

        res.json(updatedList);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Restore purchased item to active list (for undo)
app.post('/cart/:cartId/list/restore-item', resolveCart, async (req, res) => {
    try {
        const list = await ActiveList.findOne({ cartId: req.params.cartId });

        if (!list) {
            return res.status(404).json({ message: 'Active list not found' });
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

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('list-updated', { activeList: updatedList });

        res.status(201).json(updatedList);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a specific history entry
app.delete('/cart/:cartId/list/history/:historyId', resolveCart, async (req, res) => {
    try {
        await HistoryEntry.findByIdAndDelete(req.params.historyId);
        const history = await HistoryEntry.find({ cartId: req.params.cartId }).sort({ completedAt: -1 });

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('history-updated', { history });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a specific item from a history entry
app.delete('/cart/:cartId/list/history/:historyId/items/:itemId', resolveCart, async (req, res) => {
    try {
        const historyEntry = await HistoryEntry.findById(req.params.historyId);
        if (!historyEntry) {
            return res.status(404).json({ message: 'History entry not found' });
        }

        historyEntry.items.id(req.params.itemId).deleteOne();
        await historyEntry.save();

        const history = await HistoryEntry.find({ cartId: req.params.cartId }).sort({ completedAt: -1 });

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('history-updated', { history });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Clear all history for a cart
app.delete('/cart/:cartId/list/history', resolveCart, async (req, res) => {
    try {
        await HistoryEntry.deleteMany({ cartId: req.params.cartId });

        const io = req.app.get('io');
        io.to(req.params.cartId).emit('history-updated', { history: [] });

        res.json({ message: 'All history cleared' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('iShopCart Server is running!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server is flying on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
});
