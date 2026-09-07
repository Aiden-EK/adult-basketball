const express = require('express');
const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000)
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Adult Basketball Backend is running!');
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'UP',
      database: 'UP'
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    res.status(500).json({
      status: 'UP',
      database: 'DOWN'
    });
  }
});

const server = app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
