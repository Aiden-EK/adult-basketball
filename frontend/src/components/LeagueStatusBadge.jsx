const statusLabels = {
  ACTIVE: '진행 중',
  LIVE: '진행 중',
  ENDED: '종료',
  PLANNED: '예정',
}

export default function LeagueStatusBadge({ status }) {
  return <span className="status-badge">{statusLabels[status] || status}</span>
}
