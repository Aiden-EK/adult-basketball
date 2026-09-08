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
const adminTeamsRouter = require('./routes/adminTeams');
const leagueTeamsRouter = require('./routes/leagueTeams');
const adminGamesRouter = require('./routes/adminGames');
const leagueGamesRouter = require('./routes/leagueGames');
const leagueStandingsRouter = require('./routes/leagueStandings');
const playerScoresRouter = require('./routes/playerScores');
const leaguePlayerStandingsRouter = require('./routes/leaguePlayerStandings');

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
app.use('/api/admin/leagues/:leagueId/teams', adminTeamsRouter);
app.use('/api/leagues/:leagueId/participants', leagueParticipantsRouter);
app.use('/api/leagues/:leagueId/teams', leagueTeamsRouter);
app.use('/api/admin/leagues/:leagueId/games', adminGamesRouter);
app.use('/api/leagues/:leagueId/games', leagueGamesRouter);
app.use('/api/leagues/:leagueId/standings', leagueStandingsRouter);
app.use('/api/leagues/:leagueId/scorers', leaguePlayerStandingsRouter);
app.use('/api/admin/games', playerScoresRouter);
app.use('/api/games', playerScoresRouter);

const server = app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
