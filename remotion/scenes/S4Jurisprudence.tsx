import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Scale, BookOpen } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import { DECISION_67 } from '../mock/data';
// Styles réels de la page décision (elite-grid, expert-box, tag-elite…).
import '../../src/pages/Decision/DecisionPage.css';

// S4 — 04 · Jurisprudence : arrêt n° 67 du 27 novembre 2025 (réel, charte).
const S4Jurisprudence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const stampIn = spring({ frame: frame - 12, fps, config: { damping: 9, mass: 0.7 } });
  const titleIn = spring({ frame: frame - 24, fps, config: { damping: 200 } });
  const boxIn = spring({ frame: frame - 38, fps, config: { damping: 200 } });

  const zoom = interpolate(frame, [80, 140], [1, 1.13], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  return (
    <div className="rv-scene" style={{ background: '#FFFFFF' }}>
      <div className="rv-grid" style={{ opacity: 0.35 }} />
      <Caption
        kicker="04 — Jurisprudence"
        title={
          <>
            Des milliers de décisions.
            <br />
            Résumées, indexées, sourcées.
          </>
        }
        sub="Cour suprême, Conseil constitutionnel, cours d'appel — avec synthèse juridique structurée."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '25% 55%',
        }}
      >
        <BrowserFrame
          url="www.lexenegal.sn/decision/cour-supreme-20251127-arret-n67"
          width={1220}
          height={860}
          contentWidth={1080}
        >
          <div className="decisionPage" style={{ minHeight: 0 }}>
            <main className="content-main" style={{ padding: '48px 64px' }}>
              <div
                className="certification-badge"
                style={{
                  opacity: stampIn,
                  transform: `scale(${interpolate(stampIn, [0, 1], [1.6, 1])})`,
                }}
              >
                <Scale size={14} /> Source Certifiée : Lexenegal.sn
              </div>

              <h1
                className="decision-title"
                style={{
                  opacity: titleIn,
                  transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
                }}
              >
                {DECISION_67.juridiction} — {DECISION_67.reference} — {DECISION_67.chambre}
              </h1>
              <div className="decision-ref" style={{ opacity: titleIn }}>
                {DECISION_67.dateLongue}
              </div>

              <div
                className="expert-box"
                style={{
                  opacity: boxIn,
                  transform: `translateY(${interpolate(boxIn, [0, 1], [30, 0])}px)`,
                }}
              >
                <div className="expert-title">
                  <BookOpen size={14} style={{ display: 'inline', marginRight: 8 }} /> Synthèse
                  Juridique
                </div>
                <div className="tags-container">
                  <span className="tag-elite" style={{ background: '#065F46', color: '#FFF' }}>
                    {DECISION_67.matiere}
                  </span>
                  {DECISION_67.motsCles.map((kw, i) => {
                    const tIn = spring({
                      frame: frame - 48 - i * 4,
                      fps,
                      config: { damping: 200 },
                    });
                    return (
                      <span
                        key={kw}
                        className="tag-elite"
                        style={{
                          opacity: tIn,
                          transform: `translateY(${interpolate(tIn, [0, 1], [14, 0])}px)`,
                          display: 'inline-block',
                        }}
                      >
                        {kw}
                      </span>
                    );
                  })}
                </div>
                <p style={{ fontStyle: 'italic', color: '#374151', lineHeight: 1.6 }}>
                  {DECISION_67.resume}
                </p>
              </div>
            </main>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};

export default S4Jurisprudence;
