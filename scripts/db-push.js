const { execSync } = require('child_process');
require('dotenv').config();

if (process.env.DATABASE_URL) {
  try {
    console.log('Running database schema sync (prisma db push)...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('Database schema sync completed successfully!');
  } catch (error) {
    console.error('Database schema sync failed or was skipped:', error.message || error);
  }
} else {
  console.log('DATABASE_URL is not defined. Skipping database schema sync.');
}
