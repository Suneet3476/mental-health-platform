const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');  // Import dotenv
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();  // Load environment variables from .env file
const app = express();

// Create an HTTP server to work with Socket.io
const server = http.createServer(app);
const io = new Server(server);

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect('mongodb+srv://49185:PWo75YNR5InUuF7M@cluster0.io3ti.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Error connecting to MongoDB', error);
});

// Models
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}));

// JWT Middleware to protect routes
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(403).send('Access denied');
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {  // Use secret from .env
        if (err) {
            return res.status(403).send('Invalid token');
        }
        req.user = user; // Store user data for later use
        next();
    });
}

// Venter/Listener queues for matching users
let ventersQueue = [];
let listenersQueue = [];

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle vent request
    socket.on('join-vent', (user) => {
        if (listenersQueue.length > 0) {
            // Match with a listener
            const listenerSocketId = listenersQueue.shift();
            io.to(listenerSocketId).emit('matched', user); // Notify listener
            socket.emit('matched', { role: 'venter', listenerSocketId }); // Notify venter
        } else {
            ventersQueue.push(socket.id); // Add venter to the queue
            socket.emit('waiting', 'Waiting for a listener...');
        }
    });

    // Handle listen request
    socket.on('join-listen', (user) => {
        if (ventersQueue.length > 0) {
            // Match with a venter
            const venterSocketId = ventersQueue.shift();
            io.to(venterSocketId).emit('matched', user); // Notify venter
            socket.emit('matched', { role: 'listener', venterSocketId }); // Notify listener
        } else {
            listenersQueue.push(socket.id); // Add listener to the queue
            socket.emit('waiting', 'Waiting for a venter...');
        }
    });

    // Handle messages
    socket.on('message', (data) => {
        io.to(data.to).emit('message', { from: socket.id, message: data.message });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        // Remove from queues if disconnect happens while waiting
        ventersQueue = ventersQueue.filter(id => id !== socket.id);
        listenersQueue = listenersQueue.filter(id => id !== socket.id);
    });
});

// Routes
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).send('User created');
    } catch (error) {
        res.status(400).send('Error creating user');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).send('Invalid credentials');
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });  // Use secret from .env
    res.cookie('token', token, { httpOnly: true });
    res.send('Logged in successfully');
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.send('Logged out');
});

// Example protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.send(`Welcome ${req.user.id}, this is a protected route!`);
});

// Start server
server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
