const mongoose = require('mongoose');
const { getMongoUri } = require('./config');

// This service shares the cluster with the core backend but owns its own
// collection (todos). It never reads the users or notes collections — anything
// it needs about the owner comes off the JWT.
const connectDB = async () => {
  try {
    // Called from app.js AFTER loadSecrets(), so this picks up the URI that
    // Secrets Manager just put into process.env.
    await mongoose.connect(getMongoUri());
    console.log('[todo-service] MongoDB connected successfully');
  } catch (error) {
    console.error('[todo-service] MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
