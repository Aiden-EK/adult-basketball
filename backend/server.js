const express = require('express');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const pool = require('./db');
const adminMembersRouter = require('./routes/adminMembers');
const membersRouter = require('./routes/members');
const leaguesRouter = require('./routes/leagues');
const adminLeaguesRouter = require('./routes/adminLeagues');
const adminLeagueParticipantsRouter = require('./routes/adminLeagueParticipants');
const leagueParticipantsRouter = require('./routes/leagueParticipants');

const app = express();
const port = Number(process.env.PORT || 3000);

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

app.use('/api/admin/members', adminMembersRouter);
app.use('/api/members', membersRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/admin/leagues', adminLeaguesRouter);
app.use('/api/admin/leagues/:leagueId/participants', adminLeagueParticipantsRouter);
app.use('/api/leagues/:leagueId/participants', leagueParticipantsRouter);

const server = app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
