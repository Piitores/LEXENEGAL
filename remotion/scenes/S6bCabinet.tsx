import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Star, FolderPlus, Check, FileText } from 'lucide-react';
import Caption from '../ui/Caption';
import BrowserFrame from '../ui/BrowserFrame';
import Cursor from '../ui/Cursor';
import { FONT_UI } from '../theme';
import { DECISION_67, CGI_ART217_HTML } from '../mock/data';
// UI réelles : boutons favoris/dossier de la page décision + pastilles grises du CGI.
import '../../src/components/DecisionActions/DecisionActions.css';
import '../../src/pages/Code/ArticlePage.css';
import '../../src/pages/Decision/DecisionPage.css';

const FOLDERS = ['Contentieux social — CBAO', 'Licenciements 2026', 'Veille fiscale'];
const CLICK_AT = 42; // clic sur « Contentieux social »
const SWITCH_AT = 95; // bascule vers le CGI annoté

// S6b — 07 · Dossiers & annotations : classer une décision, codes annotés (CGI).
const S6bCabinet: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const menuIn = spring({ frame: frame - 18, fps, config: { damping: 15 } });
  const added = frame >= CLICK_AT;
  const toastIn = spring({ frame: frame - CLICK_AT - 4, fps, config: { damping: 12 } });

  // Bascule dossier → CGI annoté (fondu croisé interne).
  const beat1 = interpolate(frame, [SWITCH_AT - 12, SWITCH_AT + 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const beat2 = 1 - beat1;
  const noteIn = spring({ frame: frame - SWITCH_AT - 45, fps, config: { damping: 15 } });

  const zoom = interpolate(frame, [SWITCH_AT + 30, SWITCH_AT + 80], [1, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  return (
    <div className="rv-scene" style={{ background: '#FFFFFF' }}>
      <div className="rv-grid" style={{ opacity: 0.35 }} />
      <Caption
        kicker="06 — Dossiers & annotations"
        title="Votre cabinet, dans LEXENEGAL."
        sub="Classez les décisions par dossier, annotez-les — et travaillez sur des codes déjà annotés, comme le Code général des Impôts."
      />

      {/* Beat 1 — ajouter la décision à un dossier (UI réelle DecisionActions) */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          opacity: frameIn * beat1,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 900,
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 14,
            boxShadow: '0 30px 80px rgba(6,95,70,0.14)',
            padding: '38px 44px',
            fontFamily: FONT_UI,
          }}
        >
          <div className="certification-badge" style={{ marginBottom: 14 }}>
            ⚖ {DECISION_67.juridiction} — {DECISION_67.reference}
          </div>
          <div style={{ fontSize: 17, color: '#6B7280', marginBottom: 22 }}>
            {DECISION_67.chambre} · {DECISION_67.dateLongue}
          </div>

          {/* Markup réel de DecisionActions */}
          <div className="decision-actions">
            <button className="action-btn action-favorite is-favorite" style={{ flex: '0 0 auto' }}>
              <Star size={16} fill="#F59E0B" />
              <span>Favori</span>
            </button>
            <div className="folder-dropdown">
              <button className="action-btn action-folder">
                <FolderPlus size={16} />
                <span>Dossier</span>
              </button>
            </div>
          </div>

          <div
            className="folder-menu"
            style={{
              position: 'static',
              marginTop: 10,
              width: 420,
              opacity: menuIn,
              transform: `translateY(${interpolate(menuIn, [0, 1], [-10, 0])}px)`,
            }}
          >
            <div className="folder-menu-title">Ajouter au dossier</div>
            {FOLDERS.map((name, i) => (
              <button
                key={name}
                className={`folder-option ${i === 0 && added ? 'in-folder' : ''}`}
              >
                {i === 0 && added ? <Check size={14} /> : null}
                {name}
              </button>
            ))}
          </div>

          {added && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 20,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                borderRadius: 999,
                padding: '8px 18px',
                fontSize: 15.5,
                fontWeight: 600,
                opacity: toastIn,
                transform: `scale(${interpolate(toastIn, [0, 1], [0.8, 1])})`,
              }}
            >
              <Check size={15} /> Décision classée — retrouvez-la dans Mon Cabinet
            </div>
          )}
        </div>
      </div>

      {/* Beat 2 — article annoté du CGI (pastille grise réelle, art. 217) */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          opacity: beat2,
          transform: `scale(${zoom})`,
          transformOrigin: '35% 45%',
        }}
      >
        <BrowserFrame
          url="www.lexenegal.sn/code/code-general-impots/cgi-article-217"
          width={1180}
          height={840}
          contentWidth={1000}
        >
          <div className="article-page" style={{ padding: '46px 58px', minHeight: 0 }}>
            <header className="article-header" style={{ marginBottom: 14 }}>
              <div className="article-hierarchy">
                <a className="ah-row ah-row--livre">
                  <span className="ah-badge ah-badge--livre">Livre 1</span>
                  <span className="ah-label">IMPÔTS DIRECTS ET TAXES ASSIMILÉES</span>
                </a>
              </div>
              <h1>Article 217</h1>
              <div className="version-info" style={{ marginTop: 10 }}>
                <FileText size={14} />
                Code Général des Impôts · annoté (circulaires d'application)
              </div>
            </header>
            <div className="article-content-wrapper">
              <div
                className="article-text"
                dangerouslySetInnerHTML={{ __html: CGI_ART217_HTML }}
              />
            </div>
            {/* Annotation personnelle de l'utilisateur */}
            <div
              style={{
                marginTop: 20,
                border: '1px solid #A7F3D0',
                borderLeft: '3px solid #047857',
                background: '#ECFDF5',
                borderRadius: 10,
                padding: '14px 18px',
                fontFamily: FONT_UI,
                opacity: noteIn,
                transform: `translateY(${interpolate(noteIn, [0, 1], [16, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065F46', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Mon annotation
              </div>
              <div style={{ fontSize: 15.5, color: '#374151' }}>
                Dispense du 2ᵉ acompte : penser aux justificatifs des retenues (dossier Veille
                fiscale).
              </div>
            </div>
          </div>
        </BrowserFrame>
      </div>

      <Cursor
        steps={[
          { frame: 8, x: 1000, y: 830 },
          { frame: CLICK_AT - 3, x: 905, y: 555, click: true },
          { frame: CLICK_AT + 20, x: 905, y: 555 },
          { frame: SWITCH_AT + 22, x: 1240, y: 520 },
        ]}
      />
    </div>
  );
};

export default S6bCabinet;
