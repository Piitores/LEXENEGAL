import React from 'react';

/**
 * Static, motion-free end-state of the hero scene: the African continent
 * with Senegal spotlighted in West Africa. Serves as Suspense fallback,
 * reduced-motion replacement, and no-WebGL / error fallback.
 * Purely decorative (aria-hidden) — the indexable text lives in the DOM.
 */
const HeroSenegalStatic: React.FC = () => (
  <div className="hero__canvas hero__canvas--static" aria-hidden="true">
    <div className="hero__static-map">
      <img src="/Africa-countries-western.svg" alt="" className="hero__static-africa" />
      <span className="hero__static-spot" />
      <span className="hero__static-label">Sénégal</span>
    </div>
  </div>
);

export default HeroSenegalStatic;
