import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../database/pool';
import { hashPassword, comparePassword } from '../utils/encryption';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const authRouter = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, username } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await query(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, passwordHash, username || email.split('@')[0]]
    );

    const user = userResult.rows[0];

    // Check if this is the first user (make them admin)
    const userCount = await query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(userCount.rows[0].count) === 1;

    if (isFirstUser) {
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [user.id, 'admin']
      );
      console.log('✅ First user registered as admin:', user.email);
    }

    // Create profile
    await query(
      'INSERT INTO profiles (id, username) VALUES ($1, $2)',
      [user.id, username || email.split('@')[0]]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
      isAdmin: isFirstUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const userResult = await query(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if admin
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
      [user.id, 'admin']
    );

    const isAdmin = roleResult.rows.length > 0;

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
      isAdmin,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Get current user
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userResult = await query(
      'SELECT id, email, username, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: userResult.rows[0],
      isAdmin: req.user!.isAdmin,
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side token removal, but we can track it server-side later)
authRouter.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});
