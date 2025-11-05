import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';

export const customersRouter = Router();

// Apply authentication middleware
customersRouter.use(authenticateToken);

// Validation schemas
const createCustomerSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#3b82f6'),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// Get all customers
customersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT * FROM customers ORDER BY name ASC'
    );

    res.json({ customers: result.rows });
  } catch (error: any) {
    console.error('Get customers error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customers',
      details: error.message 
    });
  }
});

// Get customer by ID
customersRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });
  } catch (error: any) {
    console.error('Get customer error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer',
      details: error.message 
    });
  }
});

// Create customer
customersRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const validated = createCustomerSchema.parse(req.body);

    const result = await query(
      'INSERT INTO customers (name, description, color) VALUES ($1, $2, $3) RETURNING *',
      [validated.name, validated.description || null, validated.color]
    );

    res.status(201).json({ 
      customer: result.rows[0],
      message: 'Customer created successfully' 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create customer error:', error);
    res.status(500).json({ 
      error: 'Failed to create customer',
      details: error.message 
    });
  }
});

// Update customer
customersRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const validated = updateCustomerSchema.parse(req.body);

    // Check if customer exists
    const existingResult = await query(
      'SELECT id FROM customers WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (validated.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(validated.name);
    }
    if (validated.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(validated.description);
    }
    if (validated.color) {
      updates.push(`color = $${paramCount++}`);
      values.push(validated.color);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ 
      customer: result.rows[0],
      message: 'Customer updated successfully' 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update customer error:', error);
    res.status(500).json({ 
      error: 'Failed to update customer',
      details: error.message 
    });
  }
});

// Delete customer
customersRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM customers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ 
      message: 'Customer deleted successfully',
      customer: result.rows[0] 
    });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    res.status(500).json({ 
      error: 'Failed to delete customer',
      details: error.message 
    });
  }
});
