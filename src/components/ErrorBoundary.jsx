// src/components/ErrorBoundary.jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) return (
      <div className="error-boundary">
        <strong>Something went wrong.</strong>
        <pre>{this.state.error?.message}</pre>
      </div>
    )
    return this.props.children
  }
}
