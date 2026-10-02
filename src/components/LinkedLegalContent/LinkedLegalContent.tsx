import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, ExternalLink } from 'lucide-react';
import { articleLabel } from '../../lib/articleLabel';
import { resoudreRenvoi } from '../../lib/articleRefResolver';
import { getCodeArticleIndex } from '../../lib/codeArticleIndex';
import { findAllArticleCitations, PREFIX_BY_CODE } from '../../utils/articleLinkRenderer';
import { urlArticle } from '../../lib/urls';
import { CODES_REFONDUS, lireAdresseArticle } from '../../lib/routeTexte';
import { apercuArticle } from '../../lib/intituleArticle';
import { lireVersionAffichee, resoudreAdresseArticle } from '../../lib/articlesDuCode';
import { requeteVersion, type ParamsVersion } from '../../lib/versionsArticle';
import '../ArticleHoverPreview/ArticleHoverPreview.css';

/**
 * Rendu UNIFORME d'un contenu juridique (HTML) avec prévisualisation des renvois.
 *
 * - Préserve exactement le HTML (classes alinéa/nota/etc.) via dangerouslySetInnerHTML.
 * - Ajoute, par survol délégué, la MÊME prévisualisation riche que partout ailleurs
 *   (réutilise les classes .article-hover-preview), pour tout renvoi d'article :
 *   liens `data-article-id` (CGI…) ET liens `/code/<code>/<article>` (COCC…) ou
 *   `/ccn/<convention>/<article>` (adresses : src/lib/urls.ts).
 * Utilisé sur le corps d'article, les extraits de la page de présentation, les annotations.
 *
 * Fusion des codes 2026 (02/10/2026) : `dateCitation` = date du texte qui contient les citations
 * (publication_date du texte affiché, ou date d'effet d'une version antérieure affichée). Elle
 * choisit la numérotation d'un code refondu et date l'adresse des renvois (?ancien=&date=).
 * `renvoisRefondus` false : aucun lien vers un code refondu (la page ne sait pas dater ces renvois :
 * concordance illisible pour un ancien article peut-être non repris, cf. dateCitationCarte).
 * `numerotationPropreEnL` : le texte affiché a sa propre numérotation en « L. » (Code électoral…) ;
 * ses « article L.28 » sans nom de code sont les siens, pas ceux du Code du travail
 * (numerotationPropreEnL, relecture du 02/10/2026).
 */

interface Apercu { intitule: string | null; texte: string }

interface PreviewState {
    top: number; left: number;
    number: string; codeName: string; href: string;
    loading: boolean; apercu: Apercu | null;
}

const previewCache = new Map<string, Apercu>();
const INDISPONIBLE: Apercu = { intitule: null, texte: 'Contenu non disponible' };

/** Texte lisible d'un fragment HTML (entités décodées par le navigateur). */
const versTexte = (fragment: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = fragment;
    return tmp.textContent || '';
};

async function fetchPreviewText(
    dataId: string | null, codeSlug?: string, articleSlug?: string, params: ParamsVersion = { date: null, ancien: null },
): Promise<Apercu> {
    try {
        let id: string | undefined = dataId || undefined;
        let numero: string | null = null;
        let ancien = params.ancien;
        if (!id && codeSlug && articleSlug) {
            // Texte retiré (code-travail-2026) ou ancien slug (article-l56) : suivis jusqu'à l'article
            // qui en a repris le sujet (fusion des codes 2026).
            const cible = await resoudreAdresseArticle(codeSlug, articleSlug);
            id = cible?.id;
            numero = cible?.article_number ?? null;
            ancien = ancien ?? cible?.ancien ?? null;
        }
        if (!id) return INDISPONIBLE;
        const version = await lireVersionAffichee(id, { date: params.date, ancien }, numero);
        const apercu = apercuArticle(version?.content, versTexte);
        return apercu.texte || apercu.intitule ? apercu : INDISPONIBLE;
    } catch {
        return INDISPONIBLE;
    }
}

const LinkedLegalContent: React.FC<{
    html: string; className?: string; dateCitation?: string | null;
    renvoisRefondus?: boolean; numerotationPropreEnL?: boolean;
}> = ({ html, className, dateCitation, renvoisRefondus = true, numerotationPropreEnL = false }) => {
    const ref = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [pv, setPv] = useState<PreviewState | null>(null);

    const findLink = (target: EventTarget | null): HTMLAnchorElement | null => {
        const a = (target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
        if (!a || !ref.current?.contains(a)) return null;
        const href = a.getAttribute('href') || '';
        if (a.getAttribute('data-article-id') || lireAdresseArticle(href)) return a;
        return null;
    };

    const onOver = useCallback(async (e: React.MouseEvent) => {
        const a = findLink(e.target);
        if (!a) return;
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        const href = a.getAttribute('href') || '';
        const cible = lireAdresseArticle(href);
        const dataId = a.getAttribute('data-article-id');
        const number = a.getAttribute('data-article-number') || (a.textContent || '').trim().slice(0, 48);
        const codeName = a.getAttribute('data-code-name') || '';
        const rect = a.getBoundingClientRect();
        setPv({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, number, codeName, href: cible ? href : '', loading: true, apercu: null });
        // La clé porte la version demandée : un même article peut s'afficher daté et non daté.
        const params: ParamsVersion = { date: cible?.date ?? null, ancien: cible?.ancien ?? null };
        const key = dataId ? `${dataId}${requeteVersion(params)}` : href;
        let apercu = previewCache.get(key);
        if (apercu === undefined) {
            apercu = await fetchPreviewText(dataId, cible?.codeSlug, cible?.articleSlug, params);
            previewCache.set(key, apercu);
        }
        setPv(prev => prev ? { ...prev, loading: false, apercu: apercu! } : null);
    }, []);

    const onOut = useCallback((e: React.MouseEvent) => {
        if (findLink(e.target)) hideTimer.current = setTimeout(() => setPv(null), 160);
    }, []);

    // Linkification des citations tapées EN CLAIR dans le corps (« article L.12 du Code
    // de l'urbanisme »). On parcourt les nœuds texte hors <a> déjà présents, on ne résout
    // que les codes réellement cités (index paresseux caché), et on enveloppe les renvois
    // résolus dans un <a> vers l'article (urlArticle) - que le survol délégué ci-dessus allume comme les autres.
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
            !!a.getAttribute('data-article-id') || !!lireAdresseArticle(a.getAttribute('href') || '');
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
                const cites = findAllArticleCitations(tn.nodeValue || '', { numerotationPropreEnL })
                    // Renvois vers un code refondu qu'on ne sait pas dater : laissés en texte.
                    .filter((c) => renvoisRefondus || !CODES_REFONDUS.has(c.codeSlug));
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
                    // Code refondu : la date du texte choisit l'ancienne ou la nouvelle numérotation.
                    const renvoi = resoudreRenvoi({ numero: `${prefix}${c.articleNum}`, date: dateCitation }, indexes.get(c.codeSlug));
                    const hit = renvoi?.article;
                    if (!renvoi || !hit) continue; // citation non résolue : on laisse le texte tel quel
                    if (c.index > last) frag.appendChild(document.createTextNode(text.slice(last, c.index)));
                    const a = document.createElement('a');
                    a.href = `${urlArticle(c.codeSlug, hit.slug)}${requeteVersion(renvoi.query)}`;
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
    }, [html, dateCitation, renvoisRefondus, numerotationPropreEnL]);

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
                                {pv.loading ? <div className="preview-loading">Chargement...</div> : (
                                    <>
                                        {pv.apercu?.intitule && <p className="preview-intitule">{pv.apercu.intitule}</p>}
                                        {pv.apercu?.texte && <p>{pv.apercu.texte}</p>}
                                    </>
                                )}
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
