const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const todosRoutes = require('./routes/todos');
const adminTodosRoutes = require('./routes/adminTodos');
const connectDB = require('./lib/dbConnect');

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:3000',       // user frontend
  'http://localhost:3001',       // admin frontend
  'http://192.168.56.1:3000',
  'http://127.0.0.1',
  'http://15.206.93.53',         // EC2 public IP
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.56\.1|15\.206\.93\.53)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    console.log('[todo-service] Blocked Origin:', origin);

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));

// Database connection
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

app.use((req, res, next) => {
  console.log('[todo-service]', req.method, req.originalUrl);
  next();
});

// Lets a load balancer (or docker compose) tell this service apart from the core backend
app.get('/health', (req, res) => {
  res.json({ service: 'todo-service', status: 'ok' });
});

// Routes
app.use('/api/todos', todosRoutes);
app.use('/api/admin', adminTodosRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`[todo-service] Server running on port ${PORT}`);
  });
}

module.exports = app;
