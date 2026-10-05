import React from 'react';
import { PRIORITE_BASSE } from '../../lib/imagesSecondaires';

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
        // Filigrane (1,2 Mo) : chargé à la demande et en priorité basse, il ne retient plus
        // l'événement load (lib/imagesSecondaires.ts).
        <img 
            src="/lexenegal_new_logo.svg" 
            alt="Lexenegal Symbol" 
            loading="lazy"
            decoding="async"
            {...PRIORITE_BASSE}
            style={{ width: 'auto', height: size, opacity, objectFit: 'contain' }}
            className={className}
        />
    );
};

export default LexenegalSymbol;
