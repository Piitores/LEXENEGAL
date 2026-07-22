import { useState, useRef, useCallback } from 'react';

interface TiltStyle {
  transform: string;
  transition: string;
}

interface UseTiltEffectReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  style: TiltStyle;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
}

/**
 * 🏛️ LEXENEGAL - Hook d'effet tilt 3D
 * Applique une rotation perspective au survol de la souris.
 * 
 * @param maxRotation - Degrés max de rotation (default: 6)
 * @param scale - Facteur de scale au survol (default: 1.03)
 */
export function useTiltEffect(maxRotation = 6, scale = 1.03): UseTiltEffectReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<TiltStyle>({
    transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.4s ease-in-out',
  });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const rotateX = ((y - height / 2) / (height / 2)) * -maxRotation;
    const rotateY = ((x - width / 2) / (width / 2)) * maxRotation;

    setStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
      transition: 'transform 0.1s ease-out',
    });
  }, [maxRotation, scale]);

  const onMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.4s ease-in-out',
    });
  }, []);

  return { ref, style, onMouseMove, onMouseLeave };
}
