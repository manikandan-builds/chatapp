const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const ws = require('ws');
const path = require('path');

const User = require('./models/user');
const Message = require('./models/Message');

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use('/uploads', express.static(uploadsDir));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL,
}));

// Root route for sanity check
app.get('/', (req, res) => {
  res.send('✅ MERN Chat Backend Running');
});

// Helper: extract user info from cookie
async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      reject('no token');
    }
  });
}

// Routes
app.get('/test', (req, res) => {
  res.json('test ok');
});

app.get('/profile', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(401).json('no token');
  }
});

app.get('/messages/:userId', async (req, res) => {
  const { userId } = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createdAt: 1 });
  res.json(messages);
});

app.get('/people', async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({ username, password: hashedPassword });

    jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token, {
        sameSite: isProd ? 'none' : 'lax',
        secure: isProd,
      }).status(201).json({ id: createdUser._id });

      console.log('✅ Registered user:', username);
    });
  } catch (err) {
    res.status(500).json('User creation failed');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });

  if (!foundUser) {
    return res.status(401).json('Invalid credentials');
  }

  const passOk = bcrypt.compareSync(password, foundUser.password);
  if (!passOk) {
    return res.status(401).json('Invalid credentials');
  }

  jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
    if (err) throw err;
    res.cookie('token', token, {
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
    }).json({ id: foundUser._id });

    console.log('✅ Logged in user:', username);
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '', {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  }).json('ok');
});

// Start server after MongoDB connects
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ Connected to MongoDB');

    const server = app.listen(4040, () => {
      console.log('🚀 Server running on http://localhost:4040');
    });

    // WebSocket
    const wss = new ws.WebSocketServer({ server });

    wss.on('connection', (connection, req) => {
      function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
          client.send(JSON.stringify({
            online: [...wss.clients].map(c => ({
              userId: c.userId,
              username: c.username,
            })),
          }));
        });
      }

      connection.isAlive = true;
      connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
          connection.isAlive = false;
          clearInterval(connection.timer);
          connection.terminate();
          notifyAboutOnlinePeople();
        }, 1000);
      }, 5000);

      connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
      });

      // Extract token from cookies
      const cookies = req.headers.cookie;
      if (cookies) {
        const tokenCookie = cookies.split(';').find(str => str.trim().startsWith('token='));
        if (tokenCookie) {
          const token = tokenCookie.split('=')[1];
          if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
              if (err) throw err;
              connection.userId = userData.userId;
              connection.username = userData.username;
            });
          }
        }
      }

      connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const { recipient, text, file } = messageData;
        let filename = null;

        if (file) {
          const parts = file.name.split('.');
          const ext = parts[parts.length - 1];
          filename = Date.now() + '.' + ext;
          const filepath = path.join(__dirname, 'uploads', filename);
          const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
          fs.writeFileSync(filepath, bufferData);
        }

        if (recipient && (text || file)) {
          const messageDoc = await Message.create({
            sender: connection.userId,
            recipient,
            text,
            file: file ? filename : null,
          });

          [...wss.clients]
            .filter(c => c.userId === recipient)
            .forEach(c => c.send(JSON.stringify({
              text,
              sender: connection.userId,
              recipient,
              file: file ? filename : null,
              _id: messageDoc._id,
            })));
        }
      });

      notifyAboutOnlinePeople();
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
