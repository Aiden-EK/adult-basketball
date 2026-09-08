import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <section className="empty card app-error-boundary" role="alert">
        <h3>화면을 표시하지 못했습니다.</h3>
        <p className="muted">잠시 후 다시 시도해주세요.</p>
        <button className="primary full" type="button" onClick={() => window.location.reload()}>다시 불러오기</button>
      </section>
    }
    return this.props.children
  }
}
