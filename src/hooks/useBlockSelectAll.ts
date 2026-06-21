import { useEffect } from 'react';

// Dissuasion des copies sauvages : neutralise Ctrl+A / Cmd+A (tout sélectionner)
// sur le contenu de la page. La sélection reste possible dans les champs de saisie
// (input / textarea / contenteditable), où Ctrl+A est un usage légitime.
// NB : c'est un garde-fou de dissuasion (contournable par un utilisateur averti),
// pas une protection absolue.
export function useBlockSelectAll() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        const editable = tag === 'INPUT' || tag === 'TEXTAREA' || !!el?.isContentEditable;
        if (!editable) e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
