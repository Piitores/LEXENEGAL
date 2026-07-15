import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, FONT_DISPLAY, FONT_UI } from '../theme';

// S0 — Ouverture : emblème, wordmark, tagline, compteurs du corpus.
const S0Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const titleIn = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const subIn = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const statsIn = spring({ frame: frame - 36, fps, config: { damping: 200 } });
  const gridIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });


  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div className="rv-grid" style={{ opacity: gridIn * 0.9 }} />
      {/* Logo officiel (emblème + libellé intégrés) — fond blanc, fondu au décor. */}
      <img
        src={staticFile('Logo.png')}
        width={430}
        style={{
          transform: `scale(${0.85 + 0.15 * logoIn})`,
          opacity: Math.min(1, logoIn + titleIn),
          mixBlendMode: 'multiply',
        }}
      />
      <p
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 34,
          color: COLORS.textSecondary,
          margin: '20px 0 0',
          opacity: subIn,
          transform: `translateY(${interpolate(subIn, [0, 1], [24, 0])}px)`,
        }}
      >
        La{' '}
        <span
          style={{
            background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontStyle: 'italic',
          }}
        >
          mémoire juridique organisée
        </span>{' '}
        du Sénégal.
      </p>
      <div
        style={{
          display: 'flex',
          gap: 26,
          marginTop: 64,
          fontFamily: FONT_UI,
          opacity: statsIn,
        }}
      >
        {/* Pas de décomptes figés : le corpus évolue en permanence. */}
        {['Codes consolidés', 'Jurisprudence', 'Doctrine', 'IA connectée'].map((label, i) => {
          const chipIn = spring({ frame: frame - 36 - i * 6, fps, config: { damping: 200 } });
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                fontSize: 24,
                fontWeight: 600,
                color: COLORS.accentDark,
                opacity: chipIn,
                transform: `translateY(${interpolate(chipIn, [0, 1], [16, 0])}px)`,
              }}
            >
              {label}
              {i < 3 && <span style={{ color: '#D1D5DB' }}>·</span>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default S0Intro;
