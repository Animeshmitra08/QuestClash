import { Component, type ReactNode } from "react";

interface AssetBoundaryProps {
  /** What to draw instead if the asset fails to load (usually a plain-colour version). */
  fallback: ReactNode;
  /** For the warning message. */
  assetName: string;
  children: ReactNode;
}

interface AssetBoundaryState {
  failed: boolean;
}

/**
 * Keeps a broken or missing asset from taking down the whole 3D scene: if
 * anything inside fails to load, it logs a warning and draws `fallback` instead,
 * so the level stays playable. (Error boundaries must be class components.)
 */
export class AssetBoundary extends Component<AssetBoundaryProps, AssetBoundaryState> {
  state: AssetBoundaryState = { failed: false };

  static getDerivedStateFromError(): AssetBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`Asset "${this.props.assetName}" failed to load; using a fallback.`, error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
