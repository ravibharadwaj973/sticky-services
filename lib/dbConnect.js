const mongoose = require('mongoose');

// This service shares the cluster with the core backend but owns its own
// collection (todos). It never reads the users or notes collections — anything
// it needs about the owner comes off the JWT.
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');
    console.log('[todo-service] MongoDB connected successfully');
  } catch (error) {
    console.error('[todo-service] MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
