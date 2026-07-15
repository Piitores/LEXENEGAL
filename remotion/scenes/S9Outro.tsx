import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BookOpen, Scale, Feather, Sparkles } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_UI } from '../theme';

const PILLARS = [
  { icon: <BookOpen size={22} />, label: 'Codes consolidés' },
  { icon: <Scale size={22} />, label: 'Jurisprudence' },
  { icon: <Feather size={22} />, label: 'Doctrine' },
  { icon: <Sparkles size={22} />, label: 'IA connectée' },
];

// S9 — Appel à l'action final.
const S9Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleIn = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const ctaIn = spring({ frame: frame - 70, fps, config: { damping: 12 } });
  const urlIn = spring({ frame: frame - 95, fps, config: { damping: 200 } });

  // Double pulsation du CTA.
  const pulse =
    1 +
    0.04 *
      Math.max(
        0,
        Math.sin(((frame - 110) / 22) * Math.PI) * (frame > 110 && frame < 155 ? 1 : 0)
      );

  const underline = interpolate(frame, [100, 125], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fondu final : tout s'efface sauf l'emblème.
  const fadeOthers = interpolate(frame, [245, 268], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ background: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="rv-grid" style={{ opacity: 0.7 * fadeOthers }} />
      <img
        src={staticFile('icon-512.png')}
        width={110}
        style={{
          borderRadius: 24,
          border: '1px solid #E5E7EB',
          boxShadow: '0 16px 40px rgba(4,120,87,0.16)',
        }}
      />
      <div style={{ opacity: fadeOthers, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 72,
            color: COLORS.text,
            margin: '36px 0 0',
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [28, 0])}px)`,
          }}
        >
          Le droit sénégalais, enfin organisé.
        </h1>

        <div style={{ display: 'flex', gap: 42, marginTop: 44, fontFamily: FONT_UI }}>
          {PILLARS.map((p, i) => {
            const pIn = spring({ frame: frame - 34 - i * 7, fps, config: { damping: 200 } });
            return (
              <div
                key={p.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: COLORS.accentDark,
                  fontSize: 22,
                  fontWeight: 600,
                  opacity: pIn,
                  transform: `translateY(${interpolate(pIn, [0, 1], [18, 0])}px)`,
                }}
              >
                {p.icon}
                {p.label}
                {i < PILLARS.length - 1 && (
                  <span style={{ color: '#D1D5DB', marginLeft: 26 }}>·</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          style={{
            marginTop: 52,
            fontFamily: FONT_UI,
            fontSize: 26,
            fontWeight: 700,
            color: '#fff',
            background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
            border: 'none',
            borderRadius: 14,
            padding: '22px 54px',
            boxShadow: '0 16px 45px rgba(4,120,87,0.35)',
            opacity: ctaIn,
            transform: `scale(${interpolate(ctaIn, [0, 1], [0.7, 1]) * pulse})`,
          }}
        >
          Créez votre compte gratuit
        </button>

        <div
          style={{
            marginTop: 40,
            fontFamily: FONT_UI,
            fontSize: 42,
            fontWeight: 600,
            color: COLORS.text,
            opacity: urlIn,
            position: 'relative',
          }}
        >
          www.lexenegal.sn
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: -8,
              height: 4,
              width: `${underline}%`,
              background: COLORS.accent,
              borderRadius: 2,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 30,
            fontFamily: FONT_UI,
            fontSize: 18,
            color: COLORS.textSecondary,
            opacity: urlIn,
          }}
        >
          Recherche libre · Compte gratuit pour comparer, annoter, exporter.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default S9Outro;
