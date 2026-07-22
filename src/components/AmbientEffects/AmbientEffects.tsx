import React, { useState, useEffect, useRef } from 'react';
import { useMouseGradient } from '../../hooks/useMouseGradient';
import { useClickRipples } from '../../hooks/useClickRipples';
import './AmbientEffects.css';

/**
 * 🏛️ LEXENEGAL - Ambient Effects Layer
 *
 * Couche d'animations globales non-intrusives :
 * 1. Halo émeraude qui suit le curseur (desktop only)
 * 2. Ondulations subtiles au clic
 * 3. Particules flottantes au premier scroll
 *
 * Tout est position: fixed + pointer-events: none.
 * Ne perturbe aucun élément interactif.
 */

// Particle positions are defined once and never re-computed
const PARTICLES = [
  { top: '18%', left: '12%', delay: '0s', duration: '5s' },
  { top: '55%', left: '88%', delay: '0.8s', duration: '6s' },
  { top: '35%', left: '8%', delay: '1.6s', duration: '4.5s' },
  { top: '72%', left: '92%', delay: '2.2s', duration: '5.5s' },
  { top: '28%', left: '78%', delay: '0.4s', duration: '4.8s' },
  { top: '82%', left: '18%', delay: '1.2s', duration: '5.2s' },
  { top: '45%', left: '95%', delay: '2.8s', duration: '4.2s' },
  { top: '65%', left: '5%', delay: '3.2s', duration: '6.5s' },
];

const AmbientEffects: React.FC = () => {
  const mouseGradient = useMouseGradient();
  const ripples = useClickRipples();
  const [particlesActive, setParticlesActive] = useState(false);
  const scrollListened = useRef(false);

  // Activate particles on first scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollListened.current) {
        scrollListened.current = true;
        setParticlesActive(true);
        window.removeEventListener('scroll', handleScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Mouse Gradient Halo */}
      <div
        className="ambient-mouse-gradient"
        style={{
          left: `${mouseGradient.x}px`,
          top: `${mouseGradient.y}px`,
          opacity: mouseGradient.opacity,
        }}
      />

      {/* Click Ripples */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="ambient-ripple"
          style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
        />
      ))}

      {/* Floating Particles */}
      <div className="ambient-particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className={`ambient-particle ${particlesActive ? 'is-active' : ''}`}
            style={{
              top: p.top,
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default AmbientEffects;
