import { useEffect } from 'react';

// Référence LexeSenegal ajoutée à toute copie de contenu d'article, pour que le
// texte collé ailleurs garde sa source + le lien de consultation.
const BASE_URL = 'https://www.lexenegal.sn/code';

export function articleUrl(codeSlug: string, artSlug: string): string {
  return `${BASE_URL}/${codeSlug}/${artSlug}`;
}

// Pied de référence en texte brut (réutilisé par le bouton « Copier » et la copie manuelle).
export function attributionFooter(num: string, codeTitle: string | undefined, url: string): string {
  const ref = [num, codeTitle].filter(Boolean).join(', ');
  return `\n\n— ${ref}\nSource : LexeSenegal — ${url}`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Branche un écouteur global de copie (sélection + Ctrl/Cmd-C). Quand la sélection
// se trouve dans un élément portant data-art-slug (carte d'article ou contenu
// d'article), on ajoute au presse-papiers la référence et le lien de la page.
export function useCopyAttribution(codeSlug?: string, codeTitle?: string) {
  useEffect(() => {
    if (!codeSlug) return;
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      const text = sel?.toString() ?? '';
      if (!text.trim() || !e.clipboardData) return;

      const anchor = sel?.anchorNode ?? null;
      const startEl =
        anchor && anchor.nodeType === Node.TEXT_NODE
          ? anchor.parentElement
          : (anchor as Element | null);
      const card = startEl?.closest('[data-art-slug]') as HTMLElement | null;
      if (!card) return; // sélection hors contenu d'article : copie normale

      const artSlug = card.getAttribute('data-art-slug') || '';
      if (!artSlug) return;
      const artNum = card.getAttribute('data-art-num') || '';
      const url = articleUrl(codeSlug, artSlug);
      const ref = [artNum, codeTitle].filter(Boolean).join(', ');

      e.clipboardData.setData('text/plain', text + attributionFooter(artNum, codeTitle, url));
      const htmlBody = text
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      e.clipboardData.setData(
        'text/html',
        `${htmlBody}<p>— ${esc(ref)}<br>Source : <a href="${url}">LexeSenegal</a></p>`
      );
      e.preventDefault();
    };
    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [codeSlug, codeTitle]);
}
