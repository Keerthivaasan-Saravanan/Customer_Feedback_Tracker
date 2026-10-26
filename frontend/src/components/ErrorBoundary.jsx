import { Component } from "react";
import Icon from "./Icon.jsx";

/**
 * Catches rendering errors anywhere below it so a single broken view shows a
 * recovery message instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Rendering failed", error, info.componentStack);
  }

  handleReset() {
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fatal" role="alert">
        <span className="fatal__icon">
          <Icon name="alert" size={26} />
        </span>
        <h1>Something went wrong on this page</h1>
        <p>The rest of the application is still running. You can try this view again or reload the page.</p>
        <div className="fatal__actions">
          <button type="button" className="btn btn--primary" onClick={this.handleReset}>
            Try again
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
