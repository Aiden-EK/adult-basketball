const express = require('express');
const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const app = express();
const port = 3000;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Adult Basketball Backend is running!');
});

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS time'
    );

    res.json({
      success: true,
      message: 'PostgreSQL connection successful!',
      database: result.rows[0].database,
      time: result.rows[0].time
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'PostgreSQL connection failed'
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});