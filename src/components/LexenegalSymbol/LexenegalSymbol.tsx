import React from 'react';

interface LexenegalSymbolProps {
    size?: number;
    className?: string;
    opacity?: number;
}

/**
 * Sceau Lexenegal - SVG Symbol
 * A minimalist circle with an elegant serif "L" in emerald green.
 * Used as favicon, watermark, and brand element.
 */
const LexenegalSymbol: React.FC<LexenegalSymbolProps> = ({
    size = 48,
    className = '',
    opacity = 1
}) => {
    return (
        <img 
            src="/lexenegal_new_logo.svg" 
            alt="Lexenegal Symbol" 
            style={{ width: 'auto', height: size, opacity, objectFit: 'contain' }}
            className={className}
        />
    );
};

export default LexenegalSymbol;
