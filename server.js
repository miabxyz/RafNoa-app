// ================= PROFI FULLSTACK APP =================
// Tech: Node.js + Express + PostgreSQL + Auth + Rate Limit

// ================= BACKEND (server.js) =================

require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limit (anti spam)
app.use('/send-email', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
}));

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create tables
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();

// Mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

// Register (samo jednom koristi)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    'INSERT INTO users (username, password) VALUES ($1, $2)',
    [username, hash]
  );

  res.send('User created');
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.sendStatus(401);
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Send message
app.post('/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  await pool.query(
    'INSERT INTO messages (name, email, message) VALUES ($1,$2,$3)',
    [name, email, message]
  );

  await transporter.sendMail({
    from: email,
    to: process.env.EMAIL_USER,
    subject: `Nova poruka od ${name}`,
    text: message
  });

  res.json({ success: true });
});

// Get messages (protected)
app.get('/messages', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
  res.json(result.rows);
});

app.listen(3000, () => console.log('Server running'));


// ================= FRONTEND (public/index.html) =================

<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: Arial; background:#fff8cc; }
header { background:#ffd600; padding:15px; text-align:center; }
.tab { display:none; }
.tab.active { display:block; }
</style>
</head>
<body>
<header>PRO APP</header>

<button onclick="show('home')">Home</button>
<button onclick="show('contact')">Contact</button>
<button onclick="show('admin')">Admin</button>

<div id="home" class="tab active">
<h2>QR</h2>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://YOUR-DEPLOY-URL">
</div>

<div id="contact" class="tab">
<form id="form">
<input name="name" placeholder="Ime" required>
<input name="email" placeholder="Email" required>
<textarea name="message" required></textarea>
<button>Send</button>
</form>
</div>

<div id="admin" class="tab">
<input id="user" placeholder="user">
<input id="pass" type="password" placeholder="pass">
<button onclick="login()">Login</button>

<ul id="messages"></ul>
</div>

<script>
function show(id){
 document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 document.getElementById(id).classList.add('active');
}

// send form
form.onsubmit = async e => {
 e.preventDefault();
 await fetch('/send-email', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({
    name: form.name.value,
    email: form.email.value,
    message: form.message.value
  })
 });
 alert('Sent');
};

// login
let TOKEN = '';
async function login(){
 const res = await fetch('/login', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({username:user.value,password:pass.value})
 });
 const data = await res.json();
 TOKEN = data.token;
 loadMessages();
}

async function loadMessages(){
 const res = await fetch('/messages', {
  headers:{ Authorization: TOKEN }
 });
 const msgs = await res.json();
 messages.innerHTML = msgs.map(m=>`<li>${m.message}</li>`).join('');
}
</script>
</body>
</html>


5. Gotov live link + QR radi
*/
