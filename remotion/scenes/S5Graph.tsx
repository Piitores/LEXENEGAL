import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Scale, ChevronRight } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import Cursor from '../ui/Cursor';
import { FONT_UI } from '../theme';
import { DECISION_67 } from '../mock/data';
import '../../src/pages/Decision/DecisionPage.css';
import '../../src/pages/Code/ArticlePage.css';

const PREVIEW_AT = 70;
const CARD_AT = 150;

// S5 — 05 · Renvois cliquables : références légales ↔ décisions citantes.
const S5Graph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const previewIn = spring({ frame: frame - PREVIEW_AT, fps, config: { damping: 15 } });
  const cardIn = spring({ frame: frame - CARD_AT, fps, config: { damping: 200 } });

  // Fils émeraude animés (dash-offset piloté par frame).
  const dash = interpolate(frame, [PREVIEW_AT, PREVIEW_AT + 60], [400, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className="rv-scene" style={{ background: '#F8F9FB' }}>
      <div className="rv-grid" style={{ opacity: 0.4 }} />
      <Caption
        kicker="05 — Tout est relié"
        title={
          <>
            De la décision au texte.
            <br />
            Du texte à la décision.
          </>
        }
        sub="Articles cités cliquables, décisions citantes, loi ↔ décret d'application : le droit en graphe."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px)`,
        }}
      >
        <BrowserFrame
          url="www.lexenegal.sn/decision/cour-supreme-20251127-arret-n67"
          width={1220}
          height={860}
          contentWidth={1040}
        >
          <div style={{ padding: '52px 64px' }}>
            {/* Bloc Références Légales — classes réelles */}
            <div className="expert-box" style={{ marginTop: 0 }}>
              <div className="laws-container">
                <div className="laws-title">
                  <Scale size={12} /> Références Légales
                </div>
                {DECISION_67.articlesCites.map((art, i) => (
                  <div key={i} className="law-citation">
                    <span className="law-icon">§</span>{' '}
                    <a className="article-link">{art}</a>
                  </div>
                ))}
                <div className="law-citation">
                  <span className="law-icon">§</span>{' '}
                  <a
                    className="article-link"
                    style={{
                      background: frame > PREVIEW_AT - 12 ? 'rgba(4,120,87,0.1)' : undefined,
                      borderRadius: 4,
                    }}
                  >
                    Articles 763 et suivants, 769 et 772 du Code de procédure civile
                  </a>
                </div>
              </div>
            </div>

            {/* Aperçu au survol (gabarit ArticleHoverPreview) */}
            {frame >= PREVIEW_AT && (
              <div
                style={{
                  position: 'absolute',
                  left: 420,
                  top: 320,
                  width: 430,
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderLeft: '3px solid #047857',
                  borderRadius: 10,
                  boxShadow: '0 18px 50px rgba(0,0,0,0.14)',
                  padding: '18px 22px',
                  fontFamily: FONT_UI,
                  opacity: previewIn,
                  transform: `translateY(${interpolate(previewIn, [0, 1], [14, 0])}px)`,
                  zIndex: 5,
                }}
              >
                <div style={{ fontSize: 13, color: '#047857', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Code de Procédure civile
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#111827', margin: '6px 0' }}>
                  Article 769
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15.5, color: '#374151', lineHeight: 1.55 }}>
                  Aperçu du texte en vigueur, sans quitter la décision — cliquez pour ouvrir
                  l'article dans le code consolidé.
                </div>
              </div>
            )}

            {/* Contre-champ : décision citante sous l'article (classes réelles) */}
            {frame >= CARD_AT && (
              <section
                className="citing-decisions"
                style={{
                  marginTop: 220,
                  opacity: cardIn,
                  transform: `translateY(${interpolate(cardIn, [0, 1], [26, 0])}px)`,
                }}
              >
                <h3 style={{ fontFamily: FONT_UI }}>Décisions citant cet article</h3>
                <div className="citing-list">
                  <a className="citing-card">
                    <div className="citing-card__icon">
                      <Scale size={18} />
                    </div>
                    <div className="citing-card__content">
                      <h4>{DECISION_67.juridiction} — {DECISION_67.reference}</h4>
                      <p className="citing-card__meta">
                        {DECISION_67.chambre} · {DECISION_67.dateLongue}
                      </p>
                    </div>
                    <ChevronRight size={16} className="citing-card__arrow" />
                  </a>
                </div>
              </section>
            )}
          </div>
        </BrowserFrame>
      </div>

      {/* Fil du graphe : de la citation vers l'aperçu d'article */}
      <svg
        width="1920"
        height="1080"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <path
          d="M 1640 468 C 1760 468, 1760 560, 1560 575"
          fill="none"
          stroke="#047857"
          strokeWidth="3"
          strokeDasharray="400"
          strokeDashoffset={dash}
          opacity={frame >= PREVIEW_AT ? 0.55 : 0}
        />
      </svg>

      <Cursor
        steps={[
          { frame: 20, x: 950, y: 760 },
          { frame: PREVIEW_AT - 5, x: 1000, y: 508, click: true },
          { frame: PREVIEW_AT + 40, x: 1000, y: 508 },
        ]}
      />
    </div>
  );
};

export default S5Graph;
