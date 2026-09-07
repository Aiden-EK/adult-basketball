import { useNavigate } from 'react-router-dom'
export default function PageTitle({ eyebrow, title, description, back = false }) { const navigate = useNavigate(); return <div className="title">{back && <button className="back" onClick={() => navigate(-1)}>← 뒤로</button>}<small>{eyebrow}</small><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div> }
