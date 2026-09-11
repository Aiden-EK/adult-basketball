import { useEffect, useState } from 'react'
import { getWinningCombinations } from '../services/leagueApi'

export function useWinningCombinations(leagueId, admin = false) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (leagueId) getWinningCombinations(leagueId, admin)
      .then(result => { if (!cancelled) setState({ leagueId, admin, result, error: '' }) })
      .catch(() => { if (!cancelled) setState({ leagueId, admin, result: null, error: '필승조합을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' }) })
    return () => { cancelled = true }
  }, [leagueId, admin])
  return state?.leagueId === leagueId && state?.admin === admin ? state : { result: null, error: '' }
}
