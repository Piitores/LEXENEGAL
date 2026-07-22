import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { articleLabel } from '../../lib/articleLabel';
import { normalizeArticleNumber } from '../../lib/articleRefResolver';
import { getCodeArticleIndex } from '../../lib/codeArticleIndex';
import { findAllArticleCitations, PREFIX_BY_CODE } from '../../utils/articleLinkRenderer';
import '../ArticleHoverPreview/ArticleHoverPreview.css';

/**
 * Rendu UNIFORME d'un contenu juridique (HTML) avec prévisualisation des renvois.
 *
 * - Préserve exactement le HTML (classes alinéa/nota/etc.) via dangerouslySetInnerHTML.
 * - Ajoute, par survol délégué, la MÊME prévisualisation riche que partout ailleurs
 *   (réutilise les classes .article-hover-preview), pour tout renvoi d'article :
 *   liens `data-article-id` (CGI…) ET liens `/code/<code>/<article>` (COCC…).
 * Utilisé sur le corps d'article, les extraits de la page de présentation, les annotations.
 */

interface PreviewState {
    top: number; left: number;
    number: string; codeName: string; href: string;
    loading: boolean; text: string | null;
}

const previewCache = new Map<string, string>();

async function fetchPreviewText(dataId: string | null, codeSlug?: string, articleSlug?: string): Promise<string> {
    try {
        let id: string | undefined = dataId || undefined;
        if (!id && codeSlug && articleSlug) {
            const { data: code } = await supabase.from('laws_and_codes').select('id').eq('slug', codeSlug).maybeSingle();
            if (code) {
                const { data: art } = await supabase.from('articles').select('id').eq('slug', articleSlug).eq('code_id', code.id).maybeSingle();
                id = art?.id;
            }
        }
        if (!id) return 'Contenu non disponible';
        const { data } = await supabase.from('article_versions').select('content').eq('article_id', id).eq('is_current', true).single();
        const tmp = document.createElement('div');
        tmp.innerHTML = data?.content || '';
        const plain = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
        return plain.length > 300 ? plain.slice(0, 300) + '…' : (plain || 'Contenu non disponible');
    } catch {
        return 'Contenu non disponible';
    }
}

const LinkedLegalContent: React.FC<{ html: string; className?: string }> = ({ html, className }) => {
    const ref = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [pv, setPv] = useState<PreviewState | null>(null);

    const findLink = (target: EventTarget | null): HTMLAnchorElement | null => {
        const a = (target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
        if (!a || !ref.current?.contains(a)) return null;
        const href = a.getAttribute('href') || '';
        if (a.getAttribute('data-article-id') || /\/code\/[^/?#]+\/[^/?#]+/.test(href)) return a;
        return null;
    };

    const onOver = useCallback(async (e: React.MouseEvent) => {
        const a = findLink(e.target);
        if (!a) return;
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        const href = a.getAttribute('href') || '';
        const m = href.match(/\/code\/([^/?#]+)\/([^/?#]+)/);
        const dataId = a.getAttribute('data-article-id');
        const number = a.getAttribute('data-article-number') || (a.textContent || '').trim().slice(0, 48);
        const codeName = a.getAttribute('data-code-name') || '';
        const rect = a.getBoundingClientRect();
        setPv({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, number, codeName, href: m ? href : '', loading: true, text: null });
        const key = dataId || href;
        let text = previewCache.get(key);
        if (text === undefined) {
            text = await fetchPreviewText(dataId, m?.[1], m?.[2]);
            previewCache.set(key, text);
        }
        setPv(prev => prev ? { ...prev, loading: false, text: text! } : null);
    }, []);

    const onOut = useCallback((e: React.MouseEvent) => {
        if (findLink(e.target)) hideTimer.current = setTimeout(() => setPv(null), 160);
    }, []);

    // Linkification des citations tapées EN CLAIR dans le corps (« article L.12 du Code
    // de l'urbanisme »). On parcourt les nœuds texte hors <a> déjà présents, on ne résout
    // que les codes réellement cités (index paresseux caché), et on enveloppe les renvois
    // résolus dans un <a> /code/…/… — que le survol délégué ci-dessus allume comme les autres.
    // Idempotent : le texte déjà linkifié se retrouve dans un <a> et est ignoré au re-run.
    useEffect(() => {
        const root = ref.current;
        if (!root) return;

        // Tout renvoi d'article s'ouvre dans un NOUVEL onglet (l'utilisateur ne perd
        // pas sa page). S'applique aux liens déjà présents (CGI, COCC…) comme à ceux
        // injectés par linkify ci-dessous.
        const openInNewTab = (a: HTMLAnchorElement) => {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        };
        const isRenvoi = (a: HTMLAnchorElement) =>
            !!a.getAttribute('data-article-id') || /\/code\/[^/?#]+\/[^/?#]+/.test(a.getAttribute('href') || '');
        root.querySelectorAll('a').forEach((a) => { if (isRenvoi(a)) openInNewTab(a); });

        let cancelled = false;

        (async () => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (n) =>
                    (n.parentElement?.closest('a') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
            });
            const jobs: { tn: Text; cites: ReturnType<typeof findAllArticleCitations> }[] = [];
            let cur: Node | null;
            while ((cur = walker.nextNode())) {
                const tn = cur as Text;
                const cites = findAllArticleCitations(tn.nodeValue || '');
                if (cites.length) jobs.push({ tn, cites });
            }
            if (!jobs.length) return;

            const codeSlugs = new Set<string>();
            jobs.forEach((j) => j.cites.forEach((c) => codeSlugs.add(c.codeSlug)));
            const indexes = new Map<string, Awaited<ReturnType<typeof getCodeArticleIndex>>>();
            await Promise.all(
                [...codeSlugs].map(async (cs) => { indexes.set(cs, await getCodeArticleIndex(cs)); })
            );
            if (cancelled) return;

            for (const { tn, cites } of jobs) {
                if (!tn.parentNode) continue;
                const text = tn.nodeValue || '';
                const frag = document.createDocumentFragment();
                let last = 0;
                for (const c of cites) {
                    const prefix = PREFIX_BY_CODE[c.codeSlug] || '';
                    const hit = indexes.get(c.codeSlug)?.get(normalizeArticleNumber(`${prefix}${c.articleNum}`));
                    if (!hit) continue; // citation non résolue : on laisse le texte tel quel
                    if (c.index > last) frag.appendChild(document.createTextNode(text.slice(last, c.index)));
                    const a = document.createElement('a');
                    a.href = `/code/${c.codeSlug}/${hit.slug}`;
                    a.className = 'article-link';
                    a.setAttribute('data-code-name', hit.codeName);
                    a.setAttribute('data-linkified', '1');
                    a.textContent = c.fullMatch;
                    openInNewTab(a);
                    frag.appendChild(a);
                    last = c.index + c.length;
                }
                if (last === 0) continue; // rien de résolu dans ce nœud
                if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
                tn.parentNode.replaceChild(frag, tn);
            }
        })();

        return () => { cancelled = true; };
    }, [html]);

    const headerLabel = pv ? articleLabel({ article_number: pv.number }) : '';

    return (
        <>
            <div ref={ref} className={className} onMouseOver={onOver} onMouseOut={onOut} dangerouslySetInnerHTML={{ __html: html }} />
            {createPortal(
                <AnimatePresence>
                    {pv && (
                        <motion.div
                            className="article-hover-preview"
                            style={{ top: pv.top, left: pv.left }}
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } }}
                            onMouseLeave={() => setPv(null)}
                        >
                            <div className="preview-header">
                                <Scale size={14} />
                                <span>{headerLabel}</span>
                                {pv.codeName && <span className="preview-code">{pv.codeName}</span>}
                            </div>
                            <div className="preview-content">
                                {pv.loading ? <div className="preview-loading">Chargement...</div> : <p>{pv.text}</p>}
                            </div>
                            {pv.href && <a href={pv.href} className="preview-link" target="_blank" rel="noopener noreferrer">Voir l'article complet <ExternalLink size={12} /></a>}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

export default LinkedLegalContent;
