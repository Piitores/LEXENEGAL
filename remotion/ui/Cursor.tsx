import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface CursorStep {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

// Curseur qui se déplace entre points de passage (interpolation lissée) et
// émet une ondulation au clic.
const Cursor: React.FC<{ steps: CursorStep[] }> = ({ steps }) => {
  const frame = useCurrentFrame();
  const frames = steps.map((s) => s.frame);
  const x = interpolate(frame, frames, steps.map((s) => s.x), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const y = interpolate(frame, frames, steps.map((s) => s.y), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  const clicks = steps.filter((s) => s.click);

  return (
    <div className="rv-cursor" style={{ left: x, top: y }}>
      {clicks.map((c, i) => {
        const t = frame - c.frame;
        if (t < 0 || t > 20) return null;
        const p = t / 20;
        return (
          <div
            key={i}
            className="rv-cursor__ripple"
            style={{ transform: `scale(${0.3 + p * 1.4})`, opacity: 1 - p }}
          />
        );
      })}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))' }}>
        <path
          d="M5.5 3.2L19 11.6l-6.2 1.2-2.5 5.8L5.5 3.2z"
          fill="#111827"
          stroke="#fff"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
};

export default Cursor;
