const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');  // Import dotenv
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');  // Import express-session
const { body, validationResult } = require('express-validator');

dotenv.config();  // Load environment variables from .env file
const app = express();

// Create an HTTP server to work with Socket.io
const server = http.createServer(app);
const io = new Server(server);

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 60 * 1000 } // Session expires after 30 minutes
}));

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

// Timeouts for venters and listeners
let ventTimeout;
let listenTimeout;

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle vent request
    socket.on('join-vent', (user) => {
        if (listenersQueue.length > 0) {
            const listenerSocketId = listenersQueue.shift();
            io.to(listenerSocketId).emit('matched', user);
            socket.emit('matched', { role: 'venter', listenerSocketId });
            clearTimeout(ventTimeout); // Clear timeout on match
        } else {
            ventersQueue.push(socket.id);
            socket.emit('waiting', 'Waiting for a listener...');

            // Timeout after 2 minutes if no match is found
            ventTimeout = setTimeout(() => {
                socket.emit('timeout', 'No listener available. Please try again.');
                ventersQueue = ventersQueue.filter(id => id !== socket.id); // Remove from queue
            }, 120000); // 2 minutes
        }
    });

    // Handle listen request
    socket.on('join-listen', (user) => {
        if (ventersQueue.length > 0) {
            const venterSocketId = ventersQueue.shift();
            io.to(venterSocketId).emit('matched', user);
            socket.emit('matched', { role: 'listener', venterSocketId });
            clearTimeout(listenTimeout); // Clear timeout on match
        } else {
            listenersQueue.push(socket.id);
            socket.emit('waiting', 'Waiting for a venter...');

            // Timeout after 2 minutes if no match is found
            listenTimeout = setTimeout(() => {
                socket.emit('timeout', 'No venter available. Please try again.');
                listenersQueue = listenersQueue.filter(id => id !== socket.id); // Remove from queue
            }, 120000); // 2 minutes
        }
    });

    // Clear timeouts on successful match
    socket.on('matched', () => {
        clearTimeout(ventTimeout);
        clearTimeout(listenTimeout);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
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

app.post('/login', [
    body('username').trim().escape(),
    body('password').trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).send('Invalid credentials');
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });  // Use secret from .env
    res.cookie('token', token, { httpOnly: true });
    req.session.username = username; // Store username in session
    res.send('Logged in successfully');
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).json({ message: 'Logout successful' });
    });
});

// Protect route with session middleware
app.get('/chat', (req, res) => {
    if (req.session.username) {
        res.sendFile(__dirname + '/public/chat.html'); // Serve the chat.html file
    } else {
        res.redirect('/login.html'); // Redirect to login if not authenticated
    }
});

// Example protected route
app.get('/protected', authenticateToken, (req, res) => {
    res.send(`Welcome ${req.user.id}, this is a protected route!`);
});

// Start server
server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
