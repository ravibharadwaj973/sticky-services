const express = require('express');
const Todo = require('../model/Todo');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();
//route/admin (todo-service)

// Counters for the admin dashboard tile
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [totalTodos, doneTodos] = await Promise.all([
      Todo.countDocuments(),
      Todo.countDocuments({ isDone: true }),
    ]);

    res.json({
      stats: {
        totalTodos,
        doneTodos,
        pendingTodos: totalTodos - doneTodos,
      },
    });
  } catch (error) {
    console.error('Error fetching todo stats:', error);
    res.status(500).json({ error: 'Error fetching todo stats' });
  }
});

// Every user's todos
router.get('/todos', requireAdmin, async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 }).limit(200).lean();

    res.json({ todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Error fetching todos' });
  }
});

// Delete any todo, regardless of owner
router.delete('/todos/:id', requireAdmin, async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Error deleting todo' });
  }
});

// Wipe a user's todos — called when the core backend deletes that user
router.delete('/users/:id/todos', requireAdmin, async (req, res) => {
  try {
    const result = await Todo.deleteMany({ user: req.params.id });

    res.json({ message: 'Todos deleted successfully', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting user todos:', error);
    res.status(500).json({ error: 'Error deleting user todos' });
  }
});

module.exports = router;
