import express from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { encrypt, decrypt } from '../utils/encryption';

export const settingsRouter = express.Router();
settingsRouter.use(authenticateToken, requireAdmin);

// Get all settings (returns keys only, not decrypted values)
settingsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT id, key, description, is_encrypted, created_at, updated_at FROM application_settings ORDER BY key'
    );
    res.json({ settings: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get a specific setting (decrypted)
settingsRouter.get('/:key', async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.params;
    
    const result = await query(
      'SELECT * FROM application_settings WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    const setting = result.rows[0];
    
    // Decrypt value if encrypted
    let value = null;
    if (setting.is_encrypted && setting.value_encrypted) {
      try {
        const decrypted = decrypt(setting.value_encrypted);
        // Try to parse as JSON if it looks like JSON
        if (decrypted.startsWith('{') || decrypted.startsWith('[')) {
          value = JSON.parse(decrypted);
        } else {
          value = decrypted;
        }
      } catch (error) {
        console.error('Failed to decrypt or parse setting:', error);
      }
    }
    
    res.json({
      key: setting.key,
      value,
      description: setting.description,
      isEncrypted: setting.is_encrypted,
    });
  } catch (error) {
    next(error);
  }
});

const updateSettingSchema = z.object({
  key: z.string(),
  value: z.any(),
  description: z.string().optional(),
});

// Update or create a setting
settingsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { key, value, description } = updateSettingSchema.parse(req.body);
    
    // Convert value to string for encryption
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const valueEncrypted = encrypt(valueStr);
    
    const result = await query(
      `INSERT INTO application_settings (key, value_encrypted, description, is_encrypted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         value_encrypted = EXCLUDED.value_encrypted,
         description = COALESCE(EXCLUDED.description, application_settings.description),
         updated_at = NOW()
       RETURNING id, key, description, is_encrypted, created_at, updated_at`,
      [key, valueEncrypted, description, true]
    );
    
    res.json({ setting: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Delete a setting
settingsRouter.delete('/:key', async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.params;
    
    const result = await query(
      'DELETE FROM application_settings WHERE key = $1 RETURNING key',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    next(error);
  }
});
