import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rexcloud',
  user: process.env.DB_USER || 'rexcloud',
  password: process.env.DB_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 10000,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');
    console.log(`📍 Database: ${process.env.DB_NAME || 'rexcloud'}`);
    console.log(`📍 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    
    // Read schema SQL file
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    
    console.log('\n📦 Executing database schema...');
    
    // Execute schema (this is idempotent - uses IF NOT EXISTS)
    await client.query(schemaSql);
    
    console.log('✅ Database schema created successfully');
    
    // Check if any users exist
    const userCountResult = await client.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);
    
    if (userCount === 0) {
      console.log('\n👤 No users found - first installation detected');
      console.log('ℹ️  The first registered user will automatically become admin');
    } else {
      console.log(`\n👥 Found ${userCount} existing user(s)`);
      
      // Check if admin exists
      const adminResult = await client.query(
        'SELECT COUNT(*) FROM user_roles WHERE role = $1',
        ['admin']
      );
      const adminCount = parseInt(adminResult.rows[0].count);
      
      if (adminCount === 0) {
        console.log('⚠️  Warning: No admin users found!');
        console.log('ℹ️  Register a new account - it will become admin automatically');
      } else {
        console.log(`✅ Found ${adminCount} admin user(s)`);
      }
    }
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Database tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n✨ Migration completed successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 RexCloud Database is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the backend: npm start');
    console.log('2. Open the application in your browser');
    console.log('3. Register the first user (will become admin)');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
