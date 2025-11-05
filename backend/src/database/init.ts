import { pool } from './pool';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function initDatabase() {
  try {
    console.log('📦 Initializing database...');
    
    // Read and execute schema
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSQL);
    
    console.log('✅ Database schema created successfully');
    
    // Check if admin user exists, if not create one
    const adminCheck = await pool.query(
      'SELECT COUNT(*) FROM user_roles WHERE role = $1',
      ['admin']
    );
    
    if (parseInt(adminCheck.rows[0].count) === 0) {
      console.log('ℹ️  No admin users found. First registered user will be admin.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}
