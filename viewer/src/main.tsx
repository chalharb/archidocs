import "@xyflow/react/dist/base.css";
import "./styles.css";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

/** A render crash shows what went wrong instead of an empty page. */
class Crash extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="arc-message" role="alert">
        <h1>Something went wrong</h1>
        <pre className="arc-crash">{`${error.stack ?? error.message}\n\n${navigator.userAgent}`}</pre>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
);
