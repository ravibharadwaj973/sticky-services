const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Todo = require('../model/Todo');

jest.mock('../model/Todo');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const userToken = () =>
  jwt.sign(
    { userId: 'user123', userEmail: 'a@b.com', userName: 'Ravi' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const adminToken = () =>
  jwt.sign({ role: 'admin', email: 'ravi@gmail.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Todo Service', () => {
  let consoleSpy;
  let logSpy;

  beforeAll(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    logSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('identifies the service', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ service: 'todo-service', status: 'ok' });
    });
  });

  describe('GET /api/todos', () => {
    it('rejects requests without a token', async () => {
      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('rejects an admin token (no userId on it)', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(401);
    });

    it('returns only the caller\'s todos', async () => {
      Todo.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ _id: 't1', title: 'Buy milk' }]),
      });

      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.todos).toHaveLength(1);
      expect(Todo.find).toHaveBeenCalledWith({ user: 'user123' });
    });

    it('narrows by ?status=pending', async () => {
      Todo.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

      await request(app)
        .get('/api/todos?status=pending')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(Todo.find).toHaveBeenCalledWith({ user: 'user123', isDone: false });
    });
  });

  describe('POST /api/todos', () => {
    it('creates a todo stamped with the owner from the token', async () => {
      Todo.create.mockResolvedValue({ _id: 't1', title: 'Buy milk' });

      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ title: 'Buy milk', priority: 'high' });

      expect(response.status).toBe(201);
      expect(Todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Buy milk',
          priority: 'high',
          user: 'user123',
          userName: 'Ravi',
          userEmail: 'a@b.com',
        })
      );
    });

    it('rejects a missing title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ description: 'no title here' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Title is required' });
      expect(Todo.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown priority', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ title: 'Buy milk', priority: 'urgent' });

      expect(response.status).toBe(400);
      expect(Todo.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('updates only todos owned by the caller', async () => {
      Todo.findOneAndUpdate.mockResolvedValue({ _id: 't1', title: 'Updated' });

      const response = await request(app)
        .put('/api/todos/t1')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ title: 'Updated', isDone: true });

      expect(response.status).toBe(200);
      expect(Todo.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 't1', user: 'user123' },
        { title: 'Updated', isDone: true },
        { new: true, runValidators: true }
      );
    });

    it('returns 404 when the todo belongs to someone else', async () => {
      Todo.findOneAndUpdate.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/todos/t1')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/todos/:id/toggle', () => {
    it('flips isDone and saves', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      Todo.findOne.mockResolvedValue({ _id: 't1', isDone: false, save });

      const response = await request(app)
        .patch('/api/todos/t1/toggle')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.todo.isDone).toBe(true);
      expect(save).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('deletes the caller\'s todo', async () => {
      Todo.findOneAndDelete.mockResolvedValue({ _id: 't1' });

      const response = await request(app)
        .delete('/api/todos/t1')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(200);
      expect(Todo.findOneAndDelete).toHaveBeenCalledWith({ _id: 't1', user: 'user123' });
    });

    it('returns 404 for an unknown todo', async () => {
      Todo.findOneAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/todos/nope')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(404);
    });
  });

  describe('admin routes', () => {
    it('rejects a normal user token on /api/admin/todos', async () => {
      const response = await request(app)
        .get('/api/admin/todos')
        .set('Authorization', `Bearer ${userToken()}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Admin access required' });
    });

    it('lists every user\'s todos for an admin', async () => {
      Todo.find.mockReturnValue({
        sort: () => ({ limit: () => ({ lean: jest.fn().mockResolvedValue([{ _id: 't1', userName: 'Ravi' }]) }) }),
      });

      const response = await request(app)
        .get('/api/admin/todos')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.todos[0].userName).toBe('Ravi');
    });

    it('returns todo stats for an admin', async () => {
      Todo.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(4);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({ totalTodos: 10, doneTodos: 4, pendingTodos: 6 });
    });

    it('deletes any todo for an admin', async () => {
      Todo.findByIdAndDelete.mockResolvedValue({ _id: 't1' });

      const response = await request(app)
        .delete('/api/admin/todos/t1')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(response.status).toBe(200);
      expect(Todo.findByIdAndDelete).toHaveBeenCalledWith('t1');
    });
  });
});
