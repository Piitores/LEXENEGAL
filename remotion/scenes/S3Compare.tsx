import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Clock, FileText, GitCompare, Printer } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import Cursor from '../ui/Cursor';
import { FONT_UI } from '../theme';
import { ART45_PATH, ART45_V1964, ART45_CURRENT, CPC_SLUG } from '../mock/data';
// Le VRAI bouton d'action + les styles réels de la page article.
import ActionButton from '../../src/components/ui/ActionButton';
import '../../src/pages/Code/ArticlePage.css';

const CLICK_AT = 50;
const COLUMNS_AT = 85;
const DIFF_AT = 130;

// S3 — 03 · Comparateur de versions : art. 45 CPC, 1964 vs texte en vigueur (2013).
const S3Compare: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const columnsIn = spring({ frame: frame - COLUMNS_AT, fps, config: { damping: 18 } });
  const showColumns = frame >= COLUMNS_AT;
  const diffOn = frame >= DIFF_AT;

  const zoom = interpolate(frame, [175, 235], [1, 1.14], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  // Le surlignage diff s'active d'un coup ; on le fait « respirer » à l'arrivée.
  const html = (s: string) =>
    diffOn ? s : s.replace(/<\/?mark[^>]*>/g, '');

  return (
    <div className="rv-scene" style={{ background: '#F8F9FB' }}>
      <div className="rv-grid" style={{ opacity: 0.4 }} />
      <Caption
        kicker="03 — Comparateur de versions"
        title="Chaque article a une histoire."
        sub="1964 → 2001 → 2013 : le texte à n'importe quelle date, différences mot à mot."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '30% 52%',
        }}
      >
        <BrowserFrame
          url={`www.lexenegal.sn/code/${CPC_SLUG}/art-45`}
          width={1220}
          height={860}
          contentWidth={1180}
        >
          <div className="article-page" style={{ padding: '40px 52px', minHeight: 0 }}>
            {/* HEADER — classes réelles de la page article */}
            <header className="article-header" style={{ marginBottom: 18 }}>
              <div className="article-hierarchy">
                {ART45_PATH.map((n) => (
                  <a key={n.badge} className={`ah-row ah-row--${n.type}`}>
                    <span className={`ah-badge ah-badge--${n.type}`}>{n.badge}</span>
                    <span className="ah-label">{n.label}</span>
                  </a>
                ))}
              </div>
              <h1>Article 45</h1>
              <div className="version-info" style={{ marginTop: 12 }}>
                <Clock size={14} />
                En vigueur depuis le 6 août 2013
                <span className="version-note"> · Décret n° 2013-1071</span>
              </div>
            </header>

            {/* ACTIONS — ActionButton réel */}
            <div className="article-actions">
              <ActionButton variant="secondary" icon={<Printer size={16} />}>
                Imprimer l'article
              </ActionButton>
              <ActionButton
                variant="secondary"
                icon={<GitCompare size={16} />}
                className={frame >= CLICK_AT ? 'active' : ''}
              >
                Comparer les versions
              </ActionButton>
            </div>

            {/* COMPARAISON — deux colonnes réelles */}
            {showColumns ? (
              <div
                className="article-content-wrapper side-by-side"
                style={{
                  opacity: columnsIn,
                  transform: `translateY(${interpolate(columnsIn, [0, 1], [26, 0])}px)`,
                }}
              >
                <div className="version-column version-old">
                  <div className="version-column-header">
                    <FileText size={14} /> Version du 30 juillet 1964
                  </div>
                  <div
                    className="article-text"
                    dangerouslySetInnerHTML={{ __html: html(ART45_V1964) }}
                  />
                </div>
                <div className="version-column version-current">
                  <div className="version-column-header current">
                    <FileText size={14} /> Version actuelle (2013)
                  </div>
                  <div
                    className="article-text"
                    dangerouslySetInnerHTML={{ __html: html(ART45_CURRENT) }}
                  />
                </div>
              </div>
            ) : (
              <div className="article-content-wrapper">
                <div
                  className="article-text"
                  dangerouslySetInnerHTML={{ __html: html(ART45_CURRENT) }}
                />
              </div>
            )}
          </div>
        </BrowserFrame>
      </div>
      <Cursor
        steps={[
          { frame: 15, x: 1000, y: 800 },
          { frame: CLICK_AT - 2, x: 985, y: 468, click: true },
          { frame: CLICK_AT + 20, x: 985, y: 500 },
        ]}
      />
    </div>
  );
};

export default S3Compare;
