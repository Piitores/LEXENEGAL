import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BadgeCheck } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import { FONT_DISPLAY, FONT_UI } from '../theme';
import { CPC_TREE, CPC_SLUG, CPC_TITLE } from '../mock/data';
// Le VRAI composant d'arbre de l'application, avec ses données réelles.
import CodeNavTree from '../../src/components/CodeNavTree/CodeNavTree';
import '../../src/pages/Code/CodePage.css';

// Déploiement séquencé : un niveau du chemin vers l'art. 45 toutes les 20 frames.
const EXPANSION: Array<[number, string]> = [
  [18, 'p1'],
  [32, 'l2'],
  [46, 't1'],
  [60, 's5'],
];

// S2 — 02 · Codes consolidés : l'arbre réel du CPC se déploie jusqu'à l'art. 45.
const S2Codes: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const expanded = new Set(EXPANSION.filter(([at]) => frame >= at).map(([, id]) => id));

  // Zoom vers la Section 5 pendant le déploiement.
  const zoom = interpolate(frame, [70, 130], [1, 1.24], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });
  const badgeIn = spring({ frame: frame - 110, fps, config: { damping: 11 } });

  return (
    <div className="rv-scene" style={{ background: '#FFFFFF' }}>
      <div className="rv-grid" style={{ opacity: 0.35 }} />
      <Caption
        kicker="02 — Codes consolidés"
        title={
          <>
            Le texte en vigueur.
            <br />
            Vérifié au Journal officiel.
          </>
        }
        sub="25 codes · 16 770 articles — chaque alinéa extrait du JO et contrôlé."
      />
      <div
        style={{
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px) scale(${zoom})`,
          transformOrigin: '22% 62%',
        }}
      >
        <BrowserFrame
          url={`www.lexenegal.sn/code/${CPC_SLUG}`}
          width={1220}
          height={860}
          contentWidth={1100}
        >
          <div style={{ padding: '44px 56px' }}>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 27,
                color: '#111827',
                marginBottom: 6,
              }}
            >
              {CPC_TITLE}
            </h2>
            <p style={{ fontFamily: FONT_UI, color: '#6B7280', fontSize: 16, marginBottom: 26 }}>
              967 articles · consolidé au 6 août 2013 · Base Codes
            </p>
            {/* framer-motion neutralisé (rv-static-motion) : le déploiement est
                séquencé par frame, l'état final de chaque niveau est forcé en CSS. */}
            <div className="rv-static-motion">
              <CodeNavTree
                nodes={CPC_TREE}
                slug={CPC_SLUG}
                expandedNodes={expanded}
                onToggle={() => undefined}
                onSelect={() => undefined}
                activeNodeId={frame >= 60 ? 's5' : null}
                activeArticleSlug={frame >= 90 ? 'art-45' : null}
              />
            </div>
          </div>
        </BrowserFrame>
      </div>
      <div
        className="rv-badge"
        style={{
          position: 'absolute',
          right: 90,
          bottom: 70,
          fontFamily: FONT_UI,
          opacity: badgeIn,
          transform: `scale(${interpolate(badgeIn, [0, 1], [0.6, 1])})`,
        }}
      >
        <BadgeCheck size={22} />
        Fidèle au Journal officiel
      </div>
    </div>
  );
};

export default S2Codes;
