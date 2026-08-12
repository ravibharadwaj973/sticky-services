const express = require('express');
const Todo = require('../model/Todo');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
//route/todos

const PRIORITIES = ['low', 'medium', 'high'];

// Only the fields a client is allowed to set, normalised and validated.
const buildUpdates = (body) => {
  const updates = {};

  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.isDone !== undefined) updates.isDone = Boolean(body.isDone);
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  return updates;
};

const invalidField = (updates) => {
  if (updates.title !== undefined && !updates.title) {
    return 'Title is required';
  }
  if (updates.priority !== undefined && !PRIORITIES.includes(updates.priority)) {
    return `Priority must be one of: ${PRIORITIES.join(', ')}`;
  }
  if (updates.dueDate instanceof Date && Number.isNaN(updates.dueDate.getTime())) {
    return 'Due date is not a valid date';
  }
  return null;
};

// List the signed-in user's todos. ?status=done|pending narrows it down.
router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = { user: req.userId };

    if (req.query.status === 'done') filter.isDone = true;
    if (req.query.status === 'pending') filter.isDone = false;

    const todos = await Todo.find(filter).sort({ createdAt: -1 });

    res.json({ todos });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Error fetching todos' });
  }
});

// Get one todo
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.userId });

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ todo });
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ error: 'Error fetching todo' });
  }
});

// Create
router.post('/', requireAuth, async (req, res) => {
  try {
    const updates = buildUpdates(req.body);

    if (!updates.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const problem = invalidField(updates);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const todo = await Todo.create({
      ...updates,
      user: req.userId,
      userName: req.userName,
      userEmail: req.userEmail,
    });

    res.status(201).json({ todo });
  } catch (error) {
    console.error('Error creating todo:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid todo data' });
    }

    res.status(500).json({ error: 'Error creating todo' });
  }
});

// Update
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updates = buildUpdates(req.body);

    const problem = invalidField(updates);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ todo });
  } catch (error) {
    console.error('Error updating todo:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid update data' });
    }

    res.status(500).json({ error: 'Error updating todo' });
  }
});

// Flip done/not done without having to send the whole todo back
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.userId });

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    todo.isDone = !todo.isDone;
    await todo.save();

    res.json({ todo });
  } catch (error) {
    console.error('Error toggling todo:', error);
    res.status(500).json({ error: 'Error toggling todo' });
  }
});

// Delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.userId });

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Error deleting todo' });
  }
});

module.exports = router;
