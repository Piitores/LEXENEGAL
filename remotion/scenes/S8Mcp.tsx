import React from 'react';
import {
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Scale, BookOpen, Sparkles } from 'lucide-react';
import Caption from '../ui/Caption';
import { COLORS, FONT_UI } from '../theme';

const QUESTION = 'Quelles conditions pour licencier un délégué du personnel au Sénégal ?';
const ANSWER =
  'Le licenciement d’un délégué du personnel exige l’autorisation préalable de l’inspecteur du travail. Le ministre qui statue sur recours doit rester impartial : la Cour suprême a annulé ses décisions lorsqu’il avait défendu les mêmes salariés comme représentant syndical.';

const SOURCES = [
  { icon: 'scale', label: 'CS, arrêt n° 67 du 27 nov. 2025' },
  { icon: 'book', label: 'Code du travail' },
  { icon: 'book', label: 'Loi organique n° 2017-09' },
];

const ANSWER_AT = 90;

// S8 — 08 · Connecteur IA (MCP) : Claude répond avec les vraies sources LEXENEGAL.
const S8Mcp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const qIn = spring({ frame: frame - 30, fps, config: { damping: 15 } });
  const linkPulse = 0.45 + 0.3 * Math.sin(frame / 7);

  // Réponse en streaming mot à mot.
  const words = ANSWER.split(' ');
  const shown = Math.max(
    0,
    Math.min(words.length, Math.floor((frame - ANSWER_AT) / 1.6))
  );
  const answerText = words.slice(0, shown).join(' ');

  const zoom = interpolate(frame, [230, 285], [1, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  return (
    <div className="rv-scene" style={{ background: COLORS.dark }}>
      {/* Constellation discrète */}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: ((i * 379) % 1920),
            top: ((i * 211) % 1080),
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: '#10B981',
            opacity: 0.25 + 0.2 * Math.sin(frame / 11 + i),
          }}
        />
      ))}

      <Caption
        dark
        kicker="08 — Connecteur IA"
        title="Branchez votre IA sur le droit sénégalais."
        sub="Serveur MCP officiel : Claude répond avec les vraies sources — 12 outils de recherche juridique."
      />

      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '35% 55%',
          width: 1020,
          marginTop: 120,
        }}
      >
        {/* Liaison Claude ✳ ↔ LEXENEGAL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            marginBottom: 30,
            fontFamily: FONT_UI,
            color: '#E5E7EB',
            fontSize: 21,
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={24} color="#D97757" /> Claude
          </span>
          <svg width="180" height="8">
            <line
              x1="0"
              y1="4"
              x2="180"
              y2="4"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeDasharray="8 7"
              strokeDashoffset={-frame * 0.9}
              opacity={linkPulse}
            />
          </svg>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={staticFile('icon-512.png')} width={30} style={{ borderRadius: 6 }} />
            LEXENEGAL <span style={{ color: '#6EE7B7', fontWeight: 400 }}>· serveur MCP</span>
          </span>
        </div>

        {/* Fenêtre de chat */}
        <div className="rv-chat" style={{ fontFamily: FONT_UI }}>
          <div className="rv-chat__head">
            <Sparkles size={18} color="#D97757" />
            Claude — connecté à LEXENEGAL
          </div>

          <div
            className="rv-chat__user"
            style={{
              opacity: qIn,
              transform: `translateY(${interpolate(qIn, [0, 1], [16, 0])}px)`,
            }}
          >
            {QUESTION}
          </div>

          {frame >= ANSWER_AT && (
            <div className="rv-chat__assistant">
              {answerText}
              {shown < words.length && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 18,
                    background: '#10B981',
                    marginLeft: 4,
                    verticalAlign: -3,
                  }}
                />
              )}
              {shown >= words.length && (
                <div style={{ marginTop: 14 }}>
                  {SOURCES.map((s, i) => {
                    const sIn = spring({
                      frame: frame - (ANSWER_AT + words.length * 1.6 + 8) - i * 7,
                      fps,
                      config: { damping: 14 },
                    });
                    return (
                      <span
                        key={s.label}
                        className="rv-chat__source"
                        style={{
                          opacity: sIn,
                          transform: `translateY(${interpolate(sIn, [0, 1], [12, 0])}px)`,
                        }}
                      >
                        {s.icon === 'scale' ? <Scale size={14} /> : <BookOpen size={14} />}
                        {s.label}
                        <span style={{ opacity: 0.65 }}>· lexenegal.sn</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default S8Mcp;
