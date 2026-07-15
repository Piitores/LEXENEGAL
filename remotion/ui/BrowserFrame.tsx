import React from 'react';
import { Lock } from 'lucide-react';

// Fenêtre navigateur : les écrans de l'app y sont rendus à échelle réduite,
// dans un viewport de largeur applicative réelle (fidélité des breakpoints CSS).
const BrowserFrame: React.FC<{
  url: string;
  width: number; // largeur affichée du cadre
  height: number; // hauteur affichée du viewport
  contentWidth?: number; // largeur « réelle » de la page app (défaut 1440)
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ url, width, height, contentWidth = 1440, style, children }) => {
  const scale = width / contentWidth;
  return (
    <div className="rv-browser" style={{ width, ...style }}>
      <div className="rv-browser__bar">
        <span className="rv-browser__dot" style={{ background: '#FF5F57' }} />
        <span className="rv-browser__dot" style={{ background: '#FEBC2E' }} />
        <span className="rv-browser__dot" style={{ background: '#28C840' }} />
        <span className="rv-browser__url">
          <Lock size={13} color="#047857" />
          {url}
        </span>
      </div>
      <div className="rv-browser__viewport" style={{ height }}>
        <div
          style={{
            width: contentWidth,
            height: height / scale,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default BrowserFrame;
