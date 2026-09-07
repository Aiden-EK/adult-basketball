import { useState } from 'react'
import PageTitle from '../../components/PageTitle'
import { ErrorMessage } from '../../components/Status'
import { createLeague } from '../../services/leagueApi'

export default function AdminLeagueCreatePage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState(1)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) { event.preventDefault(); setSaving(true); setMessage(''); setError(''); try { await createLeague({ name, year: Number(year), quarter: Number(quarter) }); setMessage('리그를 생성했습니다.'); setName('') } catch (e) { setError(e.status === 409 ? '이미 같은 연도와 분기의 리그가 존재합니다.' : e.status === 400 ? e.message : '리그를 생성하지 못했습니다.') } finally { setSaving(false) } }
  return <><PageTitle eyebrow="ADMIN · LEAGUES" title="새 리그 만들기" description="새 분기 리그를 등록합니다." back /><form className="form card" onSubmit={submit}><label htmlFor="year">연도</label><input id="year" type="number" min="2000" value={year} onChange={(e) => setYear(e.target.value)} /><label htmlFor="quarter">분기</label><select id="quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)}><option value="1">1분기</option><option value="2">2분기</option><option value="3">3분기</option><option value="4">4분기</option></select><label htmlFor="name">리그명</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2026년 4분기 리그" required /><button className="primary full" disabled={saving}>{saving ? '생성 중...' : '리그 생성'}</button>{message && <p className="success">{message}</p>}{error && <ErrorMessage text={error} />}</form></>
}
