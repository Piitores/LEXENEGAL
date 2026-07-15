import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Search, Scale, BookOpen, ArrowRight } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import Cursor from '../ui/Cursor';
import NavbarStatic from '../ui/NavbarStatic';
import { FONT_DISPLAY, FONT_UI } from '../theme';
import { SEARCH_QUERY, SEARCH_RESULTS } from '../mock/data';
// Markup et classes = Spotlight réel du Hero (src/components/Hero/Hero.tsx).
import '../../src/components/Hero/Hero.css';

const TYPE_START = 26;
const TYPE_SPEED = 1.35; // frames par caractère
const RESULTS_AT = TYPE_START + Math.ceil(SEARCH_QUERY.length * TYPE_SPEED) + 10;

// S1 — 01 · Recherche intelligente : frappe de la question, résultats mêlés.
const S1Search: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const chars = Math.max(
    0,
    Math.min(SEARCH_QUERY.length, Math.floor((frame - TYPE_START) / TYPE_SPEED))
  );
  const typed = SEARCH_QUERY.slice(0, chars);
  const caretOn = Math.floor(frame / 12) % 2 === 0 && frame > 16;
  const previewOpen = frame >= RESULTS_AT;
  const previewIn = spring({ frame: frame - RESULTS_AT, fps, config: { damping: 18 } });

  // Zoom final sur le premier résultat.
  const zoom = interpolate(frame, [RESULTS_AT + 35, RESULTS_AT + 65], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });
  const firstHover = frame >= RESULTS_AT + 40;

  return (
    <div className="rv-scene" style={{ background: '#F8F9FB' }}>
      <div className="rv-grid" style={{ opacity: 0.5 }} />
      <Caption
        kicker="01 — Recherche intelligente"
        title="Posez votre question. En français."
        sub="La recherche sémantique comprend le sens — pas seulement les mots-clés."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '30% 32%',
        }}
      >
        <BrowserFrame url="www.lexenegal.sn" width={1220} height={860} contentWidth={1260}>
          <NavbarStatic />
          <div style={{ padding: '110px 90px 0', textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 44,
                color: '#111827',
                lineHeight: 1.2,
                marginBottom: 36,
              }}
            >
              La{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                mémoire juridique organisée
              </span>
              <br />
              du Sénégal.
            </h1>

            {/* SPOTLIGHT — classes réelles */}
            <div className={`spotlight ${frame > 20 ? 'spotlight--active' : ''}`}>
              <div className="spotlight__bar">
                <Search className="spotlight__icon" size={22} />
                <div
                  className="spotlight__input"
                  style={{
                    fontFamily: FONT_UI,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    color: typed ? '#111827' : '#9CA3AF',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {typed || 'Rechercher jurisprudence, articles de loi...'}
                  {caretOn && (
                    <span style={{ width: 2, height: 24, background: '#047857', marginLeft: 2 }} />
                  )}
                </div>
                <button className="spotlight__btn">
                  <ArrowRight size={18} />
                </button>
              </div>

              {previewOpen && (
                <div
                  className="spotlight__preview"
                  style={{
                    opacity: previewIn,
                    transform: `translateY(${interpolate(previewIn, [0, 1], [-12, 0])}px)`,
                    // Le backdrop-filter du site ne rend pas en headless → fond opaque.
                    background: '#FFFFFF',
                    zIndex: 10,
                    boxShadow: '0 24px 60px rgba(0,0,0,0.14)',
                  }}
                >
                  <div className="spotlight__results">
                    {SEARCH_RESULTS.map((r, i) => {
                      const rIn = spring({
                        frame: frame - RESULTS_AT - 4 - i * 4,
                        fps,
                        config: { damping: 200 },
                      });
                      return (
                        <button
                          key={i}
                          className="spotlight__result"
                          style={{
                            opacity: rIn,
                            transform: `translateY(${interpolate(rIn, [0, 1], [14, 0])}px)`,
                            background: i === 0 && firstHover ? 'rgba(4,120,87,0.06)' : undefined,
                          }}
                        >
                          <span className="spotlight__result-icon">
                            {r.type === 'decision' ? <Scale size={16} /> : <BookOpen size={16} />}
                          </span>
                          <div className="spotlight__result-content">
                            <span className="spotlight__result-title">{r.title}</span>
                            <span className="spotlight__result-subtitle">{r.subtitle}</span>
                          </div>
                          <span className={`spotlight__result-badge ${r.type}`}>
                            {r.type === 'decision' ? '⚖️' : '📖'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button className="spotlight__all">
                    Voir tous les résultats <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div
              className="hero__suggestions"
              style={{ justifyContent: 'center', opacity: previewOpen ? 0 : 1 }}
            >
              <span className="hero__suggestions-label">Essayez :</span>
              {['Licenciement', 'Article 5 COCC', 'Code pénal'].map((tag) => (
                <button key={tag} className="hero__suggestion-tag">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </BrowserFrame>
      </div>
      <Cursor
        steps={[
          { frame: 8, x: 900, y: 720 },
          { frame: 22, x: 1180, y: 452, click: true },
          { frame: RESULTS_AT + 25, x: 1180, y: 452 },
          { frame: RESULTS_AT + 42, x: 1150, y: 560, click: true },
        ]}
      />
    </div>
  );
};

export default S1Search;
