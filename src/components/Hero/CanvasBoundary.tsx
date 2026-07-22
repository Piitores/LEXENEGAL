import React from 'react';

/**
 * Catches any render/WebGL error from the lazy 3D backdrop and shows the
 * provided static fallback instead - the hero must never break on a device
 * without WebGL or under GPU pressure.
 */
class CanvasBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Non-fatal: the hero text + static silhouette remain.
    console.warn('HeroCanvas failed, falling back to static silhouette:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default CanvasBoundary;
