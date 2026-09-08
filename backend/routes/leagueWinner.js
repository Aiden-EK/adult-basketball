const express = require('express'); const pool = require('../db'); const { LeagueWinnerError, readLeagueWinner } = require('../services/leagueWinner')
const router = express.Router({ mergeParams: true })
const id = value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null
router.get('/', async (req, res) => { const leagueId=id(req.params.leagueId); if(!leagueId)return res.status(400).json({message:'Invalid league id'}); try{res.json(await readLeagueWinner(pool,leagueId))}catch(error){if(error instanceof LeagueWinnerError)return res.status(error.status).json({message:error.message});console.error('League winner query failed:',error);res.status(500).json({message:'서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})} })
module.exports=router
