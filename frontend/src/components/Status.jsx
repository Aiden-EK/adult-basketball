export function Loading() { return <div className="loading card">불러오는 중...</div> }
export function EmptyState({ text }) { return <div className="empty card"><h3>{text}</h3></div> }
export function ErrorMessage({ text = '정보를 불러오지 못했습니다.' }) { return <div className="error">{text}</div> }
