const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const todosRoutes = require('./routes/todos');
const adminTodosRoutes = require('./routes/adminTodos');
const connectDB = require('./lib/dbConnect');
const { loadSecrets } = require('./lib/secrets');

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

app.use((req, res, next) => {
  console.log('[todo-service]', req.method, req.originalUrl);
  next();
});

// Lets a load balancer (or docker compose) tell this service apart from the core backend
app.get('/health', (req, res) => {
  res.json({ service: 'todo-service', status: 'ok' });
});

// Routes.
// Everything this service owns lives under /api/todos, so nginx can route the
// whole service with one `location /api/todos` rule. It deliberately does NOT
// serve /api/admin — the core backend owns that prefix, and both claiming
// /api/admin/stats made them impossible to tell apart behind one proxy.
// Admin is mounted first so /api/todos/admin/* never reaches the /:id handler.
app.use('/api/todos/admin', adminTodosRoutes);
app.use('/api/todos', todosRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Secrets first (they carry MONGODB_URI and JWT_SECRET), then the database,
// then start listening. Nothing serves traffic until the config is settled.
const start = async () => {
  try {
    const { source } = await loadSecrets();
    // Printed on every boot so CloudWatch shows at a glance whether this
    // container is on the real secret or on a .env that got baked in.
    console.log(`[todo-service] config source: ${source}`);
  } catch (error) {
    console.error('[todo-service][secrets]', error.message);
    console.error('[todo-service][secrets] Refusing to start on possibly stale .env values.');
    process.exit(1);
  }

  connectDB();

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`[todo-service] Server running on port ${PORT}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

module.exports = app;
