import { useState, useEffect, useCallback } from 'react';

interface MouseGradientState {
  x: number;
  y: number;
  opacity: number;
}

/**
 * 🏛️ LEXENEGAL - Hook de suivi du curseur
 * Crée un halo lumineux émeraude qui suit la souris.
 * Désactivé automatiquement sur les écrans tactiles.
 */
export function useMouseGradient(): MouseGradientState {
  const [state, setState] = useState<MouseGradientState>({ x: 0, y: 0, opacity: 0 });

  const handleMove = useCallback((e: MouseEvent) => {
    setState({ x: e.clientX, y: e.clientY, opacity: 1 });
  }, []);

  const handleLeave = useCallback(() => {
    setState(prev => ({ ...prev, opacity: 0 }));
  }, []);

  useEffect(() => {
    // Skip on touch devices - no point tracking a cursor that doesn't exist
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, [handleMove, handleLeave]);

  return state;
}
