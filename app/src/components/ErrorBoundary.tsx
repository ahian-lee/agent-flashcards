import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort render error boundary: a broken card must never leave the user
 * with a blank screen and no way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Agent 闪卡] render error', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.hash = '#/'
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ error: null })
    window.location.hash = '#/'
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash">
        <h1>页面出错了</h1>
        <p className="crash__message">{error.message}</p>
        <p className="muted">学习进度保存在本机 IndexedDB 中，刷新不会丢失。</p>
        <div className="crash__actions">
          <button type="button" className="btn btn--primary" onClick={this.handleReload}>
            重新加载
          </button>
          <button type="button" className="btn" onClick={this.handleReset}>
            回到首页
          </button>
        </div>
        <details className="crash__details">
          <summary>错误详情</summary>
          <pre>{error.stack ?? error.message}</pre>
        </details>
      </div>
    )
  }
}
