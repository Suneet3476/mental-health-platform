const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');  // Import dotenv

dotenv.config();  // Load environment variables from .env file
const app = express();

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
        req.user = user; // store user data for later use
        next();
    });
}

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

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
