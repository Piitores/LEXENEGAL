import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_DISPLAY, FONT_UI } from '../theme';

// Cartouche d'annonce d'une fonctionnalité : kicker / titre / sous-texte,
// entrée séquencée pilotée par la frame courante.
const Caption: React.FC<{
  kicker: string;
  title: React.ReactNode;
  sub: string;
  dark?: boolean;
  delay?: number;
}> = ({ kicker, title, sub, dark, delay = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line = (at: number) => {
    const p = spring({ frame: frame - delay - at, fps, config: { damping: 200 } });
    return {
      opacity: p,
      transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px)`,
    };
  };

  return (
    <div className="rv-caption">
      <div className="rv-caption__kicker" style={{ fontFamily: FONT_UI, ...line(0) }}>
        {kicker}
      </div>
      <div
        className="rv-caption__title"
        style={{
          fontFamily: FONT_DISPLAY,
          color: dark ? '#F9FAFB' : undefined,
          ...line(6),
        }}
      >
        {title}
      </div>
      <div
        className="rv-caption__sub"
        style={{
          fontFamily: FONT_UI,
          color: dark ? 'rgba(229,231,235,0.75)' : undefined,
          ...line(12),
        }}
      >
        {sub}
      </div>
    </div>
  );
};

export default Caption;
