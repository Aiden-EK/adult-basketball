const express = require('express');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true
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
const authRouter = require('./routes/auth');
const { loadUser, requireAdmin } = require('./middleware/auth');
const leagueWinnerRouter = require('./routes/leagueWinner');
const adminAttendanceRouter = require('./routes/adminAttendance');
const leagueAttendanceRouter = require('./routes/leagueAttendance');
const leagueWinImpactRouter = require('./routes/leagueWinImpact');
const winningCombinationsRouter = require('./routes/leagueWinningCombinations');

const app = express();
const port = Number(process.env.PORT || 3000);

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (_req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(loadUser);

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

app.use('/api/auth', authRouter);
app.use('/api/admin', requireAdmin);
app.use('/api/admin/members', adminMembersRouter);
app.use('/api/members', requireAdmin, membersRouter);
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
app.use('/api/leagues/:leagueId/winner', leagueWinnerRouter);
app.use('/api/admin/games', playerScoresRouter);
app.use('/api/admin/leagues/:leagueId/attendance', adminAttendanceRouter);
app.use('/api/leagues/:leagueId/attendance', leagueAttendanceRouter);
app.use('/api/leagues/:leagueId/win-impact', leagueWinImpactRouter);
app.use('/api/leagues/:leagueId/winning-combinations', winningCombinationsRouter(7));
app.use('/api/admin/leagues/:leagueId/winning-combinations', winningCombinationsRouter(20));
app.use('/api/games', playerScoresRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: '요청한 API를 찾을 수 없습니다.' });
});

app.use((error, req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: '요청 본문의 JSON 형식이 올바르지 않습니다.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ message: '요청 데이터가 너무 큽니다.' });
  }

  console.error(`Unhandled request error: ${req.method} ${req.originalUrl}`);
  return res.status(500).json({ message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
});

const server = app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
