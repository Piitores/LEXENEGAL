import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Download, Printer, Copy, FileText, Scale } from 'lucide-react';
import Caption from '../ui/Caption';
import Cursor from '../ui/Cursor';
import { FONT_DISPLAY, FONT_UI } from '../theme';
import { DECISION_67 } from '../mock/data';
// Le VRAI bouton d'action de l'app + styles page décision.
import ActionButton from '../../src/components/ui/ActionButton';
import '../../src/pages/Decision/DecisionPage.css';

const CLICK_AT = 45;
const PDF_AT = 80;

// S7 — 07 · Export PDF premium.
const S7Pdf: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frameIn = spring({ frame, fps, config: { damping: 16 } });
  const pdfIn = spring({ frame: frame - PDF_AT, fps, config: { damping: 13 } });
  const busy = frame >= CLICK_AT && frame < PDF_AT + 10;

  const zoom = interpolate(frame, [PDF_AT + 40, PDF_AT + 90], [1, 1.16], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  return (
    <div className="rv-scene" style={{ background: '#F8F9FB' }}>
      <div className="rv-grid" style={{ opacity: 0.4 }} />
      <Caption
        kicker="07 — Export PDF"
        title="Prêt pour le dossier de plaidoirie."
        sub="Un document soigné : en-tête prestige, synthèse, texte intégral certifié."
      />

      {/* Colonne d'outils réelle (sidebar droite de la page décision) */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 380,
          width: 330,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          opacity: frameIn,
          transform: `translateX(${interpolate(frameIn, [0, 1], [120, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: FONT_UI, fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
          Outils du document
        </div>
        <ActionButton variant="primary" icon={<Download size={18} />}>
          {busy ? 'Génération…' : 'Télécharger le PDF'}
        </ActionButton>
        <ActionButton variant="secondary" icon={<Printer size={16} />}>
          Imprimer
        </ActionButton>
        <ActionButton variant="secondary" icon={<Copy size={16} />}>
          Copier Référence
        </ActionButton>
        <ActionButton variant="secondary" icon={<FileText size={16} />}>
          Mes Annotations
        </ActionButton>
      </div>

      {/* Page A4 prestige qui se matérialise */}
      <div
        style={{
          position: 'absolute',
          left: 1210,
          top: 180,
          perspective: 1400,
          opacity: pdfIn,
        }}
      >
        <div
          className="rv-pdf"
          style={{
            transform: `translateY(${interpolate(pdfIn, [0, 1], [80, 0])}px) rotateY(${interpolate(
              pdfIn,
              [0, 1],
              [24, -8]
            )}deg) scale(${zoom})`,
            transformOrigin: '50% 30%',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              borderBottom: '2px solid #047857',
              paddingBottom: 18,
              marginBottom: 22,
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, letterSpacing: '0.08em', color: '#065F46' }}>
              LEXENEGAL
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: 11, color: '#6B7280', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 4 }}>
              Mémoire juridique du Sénégal
            </div>
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: '#111827', textAlign: 'center', lineHeight: 1.35 }}>
            {DECISION_67.juridiction}
            <br />
            {DECISION_67.reference}
          </div>
          <div style={{ fontFamily: FONT_UI, fontSize: 12.5, color: '#6B7280', textAlign: 'center', margin: '10px 0 18px' }}>
            {DECISION_67.chambre} · {DECISION_67.dateLongue}
          </div>
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 11,
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 16,
            }}
          >
            <Scale size={12} /> Source certifiée · lexenegal.sn
          </div>
          {[92, 100, 96, 88, 100, 94, 60].map((w, i) => (
            <div
              key={i}
              style={{
                height: 7,
                width: `${w}%`,
                background: i === 0 ? '#D1FAE5' : '#E5E7EB',
                borderRadius: 4,
                marginBottom: 9,
              }}
            />
          ))}
        </div>
      </div>

      <Cursor
        steps={[
          { frame: 10, x: 780, y: 830 },
          { frame: CLICK_AT - 3, x: 700, y: 452, click: true },
          { frame: CLICK_AT + 25, x: 700, y: 452 },
        ]}
      />
    </div>
  );
};

export default S7Pdf;
