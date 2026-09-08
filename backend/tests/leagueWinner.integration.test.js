const assert=require('node:assert/strict');const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','..','.env')});const pool=require('../db');const {LeagueWinnerError,readLeagueWinner,setLeagueWinner}=require('../services/leagueWinner')
async function rejects(action,status){await assert.rejects(action,error=>error instanceof LeagueWinnerError&&error.status===status)}
async function main(){const client=await pool.connect();try{await client.query('BEGIN');await client.query(`
INSERT INTO league(id,year,quarter,name,status) VALUES(91600,2096,1,'[TEST] 종료','COMPLETED'),(91601,2096,2,'[TEST] 진행','ACTIVE'),(91602,2096,3,'[TEST] 예정','PLANNED'),(91603,2096,4,'[TEST] 다른 리그','COMPLETED');
INSERT INTO team(id,league_id,name,sort_order) VALUES(91600,91600,'[TEST] A',1),(91601,91600,'[TEST] B',2),(91603,91603,'[TEST] 타리그',1);
INSERT INTO member(id,name) VALUES(91600,'[TEST] 우승 멤버'),(91601,'[TEST] 다른 멤버');
INSERT INTO league_member(id,league_id,member_id,team_id) VALUES(91600,91600,91600,91600),(91601,91603,91601,91603);`)
assert.equal((await readLeagueWinner(client,91600)).winner,null)
await rejects(()=>setLeagueWinner(client,999999,91600),404);await rejects(()=>setLeagueWinner(client,91600,999999),404);await rejects(()=>setLeagueWinner(client,91600,91603),400);await rejects(()=>setLeagueWinner(client,91601,91600),409);await rejects(()=>setLeagueWinner(client,91602,91600),409)
let result=await setLeagueWinner(client,91600,91600);assert.equal(result.winner.teamName,'[TEST] A');assert.deepEqual(result.winner.members,[{memberId:91600,name:'[TEST] 우승 멤버'}])
result=await setLeagueWinner(client,91600,91601);assert.equal(result.winner.teamId,91601)
assert.equal(result.winner.members.some(member=>member.memberId===91601),false);console.log('리그 우승팀 통합 테스트 10개 통과')
}finally{await client.query('ROLLBACK');client.release();await pool.end()}}
main().catch(error=>{console.error(error);process.exitCode=1})
