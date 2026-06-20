import React from 'react';
import ArticleHoverPreview from '../../components/ArticleHoverPreview/ArticleHoverPreview';

// Rend le HTML d'une annotation en transformant les liens d'article (porteurs de
// data-article-id, générés pour les renvois « Texte d'application ») en liens qui
// ouvrent un nouvel onglet ET affichent une prévisualisation de l'article au survol.
// Les autres annotations passent par un rendu HTML simple (voir ArticlePage).
function renderNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const children = Array.from(el.childNodes).map((c, i) => renderNode(c, `${key}.${i}`));

  if (el.tagName === 'A') {
    const href = el.getAttribute('href') || '#';
    const artId = el.getAttribute('data-article-id');
    const link = (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="article-link">
        {children}
      </a>
    );
    if (artId) {
      return (
        <ArticleHoverPreview
          key={key}
          articleId={artId}
          articleNumber={el.getAttribute('data-article-number') || ''}
          codeName={el.getAttribute('data-code-name') || ''}
          codeSlug={el.getAttribute('data-code-slug') || ''}
          articleSlug={el.getAttribute('data-article-slug') || ''}
        >
          {link}
        </ArticleHoverPreview>
      );
    }
    return link;
  }

  return React.createElement(
    el.tagName.toLowerCase(),
    { key },
    children.length ? children : undefined
  );
}

const AnnotationContent: React.FC<{ html: string }> = ({ html }) => {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return <>{Array.from(body.childNodes).map((n, i) => renderNode(n, `n${i}`))}</>;
};

export default AnnotationContent;
