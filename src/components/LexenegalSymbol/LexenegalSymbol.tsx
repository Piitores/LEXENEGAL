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
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ opacity }}
            aria-label="Lexenegal"
        >
            {/* Circle border */}
            <circle
                cx="50"
                cy="50"
                r="48"
                stroke="#047857"
                strokeWidth="2"
                fill="none"
            />

            {/* Elegant "L" in Playfair Display style (serif) */}
            <text
                x="50"
                y="68"
                textAnchor="middle"
                fontFamily="'Playfair Display', Georgia, serif"
                fontSize="52"
                fontWeight="600"
                fill="#047857"
            >
                L
            </text>
        </svg>
    );
};

export default LexenegalSymbol;
