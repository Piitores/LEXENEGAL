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
import { STATS } from '../mock/data';

// S0 — Ouverture : emblème, wordmark, tagline, compteurs du corpus.
const S0Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const titleIn = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const subIn = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const statsIn = spring({ frame: frame - 70, fps, config: { damping: 200 } });
  const gridIn = interpolate(frame, [0, 50], [0, 1], { extrapolateRight: 'clamp' });

  const counter = (target: number) =>
    Math.round(
      interpolate(frame, [70, 130], [0, target], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: (t) => 1 - Math.pow(1 - t, 4),
      })
    ).toLocaleString('fr-FR');

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
          gap: 56,
          marginTop: 72,
          fontFamily: FONT_UI,
          opacity: statsIn,
        }}
      >
        {(
          [
            [counter(STATS.codes), 'codes consolidés'],
            [counter(STATS.decisions), 'décisions de justice'],
            [counter(STATS.textes), 'textes en vigueur'],
          ] as const
        ).map(([n, label]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.accent }}>{n}</div>
            <div style={{ fontSize: 21, color: COLORS.textSecondary, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default S0Intro;
