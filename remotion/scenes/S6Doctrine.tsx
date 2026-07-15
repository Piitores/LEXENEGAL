import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BookOpen, ChevronRight } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import { FONT_UI } from '../theme';
import '../../src/pages/Code/ArticlePage.css';

const CARDS = [
  {
    title: 'Le régime des fins de non-recevoir après le décret n° 2013-1071',
    meta: 'Doctrine · Procédure civile',
  },
  {
    title: 'La mise en état des affaires civiles : bilan de la réforme de 2001',
    meta: 'Doctrine · Procédure civile',
  },
];

// S6 — 06 · Doctrine rattachée à l'article.
const S6Doctrine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const zoom = interpolate(frame, [80, 140], [1, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  return (
    <div className="rv-scene" style={{ background: '#FFFFFF' }}>
      <div className="rv-grid" style={{ opacity: 0.35 }} />
      <Caption
        kicker="06 — Doctrine"
        title="Le commentaire, au pied du texte."
        sub="La doctrine est rattachée à l'article exact qu'elle commente."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '25% 40%',
        }}
      >
        <BrowserFrame
          url="www.lexenegal.sn/code/code-de-procedure-civile/art-45"
          width={1220}
          height={860}
          contentWidth={1040}
        >
          <div style={{ padding: '56px 64px' }}>
            <section className="citing-decisions doctrine-section" style={{ marginTop: 0 }}>
              <h3 style={{ fontFamily: FONT_UI }}>
                <BookOpen size={18} style={{ display: 'inline', marginRight: 10, verticalAlign: -3 }} />
                Doctrine sur cet article
              </h3>
              <div className="citing-list">
                {CARDS.map((c, i) => {
                  const cIn = spring({
                    frame: frame - 25 - i * 14,
                    fps,
                    config: { damping: 17 },
                  });
                  return (
                    <a
                      key={c.title}
                      className="citing-card doctrine-card"
                      style={{
                        opacity: cIn,
                        transform: `translateX(${interpolate(cIn, [0, 1], [90, 0])}px)`,
                      }}
                    >
                      <div className="citing-card__icon">
                        <BookOpen size={18} />
                      </div>
                      <div className="citing-card__content text-left">
                        <h4>{c.title}</h4>
                        <p className="citing-card__meta">{c.meta}</p>
                      </div>
                      <ChevronRight size={16} className="citing-card__arrow" />
                    </a>
                  );
                })}
              </div>
            </section>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};

export default S6Doctrine;
