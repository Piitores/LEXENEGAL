// Arbre de navigation d'un code (Titre > Chapitre > Section + pastilles d'articles).
// Partagé entre la page Code et la page Article - rendu et classes CSS identiques.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { articleLabel } from '../../lib/articleLabel';
import { urlArticle } from '../../lib/urls';
import { HierarchyNode, countArticles, computeMaxArticlesInLevel, formatNodeLabel, segmentsNoeud } from '../../lib/codeTree';
import './CodeNavTree.css';

interface CodeNavTreeProps {
    nodes: HierarchyNode[];
    // Slug en base du texte : l'adresse des pastilles d'article en découle (urlArticle :
    // /ccn/… pour une convention collective, /code/… pour le reste).
    slug: string | undefined;
    expandedNodes: Set<string>;
    onToggle: (id: string) => void;
    onSelect: (node: HierarchyNode) => void;
    activeNodeId?: string | null;
    activeArticleSlug?: string | null;
    // Optionnel : ref posée sur le bouton du nœud actif (scroll-into-view côté page Code).
    activeNodeRef?: React.Ref<HTMLButtonElement>;
}

const CodeNavTree: React.FC<CodeNavTreeProps> = ({
    nodes,
    slug,
    expandedNodes,
    onToggle,
    onSelect,
    activeNodeId = null,
    activeArticleSlug = null,
    activeNodeRef,
}) => {
    const maxArticlesInLevel = useMemo(() => computeMaxArticlesInLevel(nodes), [nodes]);

    const renderTreeNode = (node: HierarchyNode, depth: number = 0): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.id);
        const isActive = activeNodeId === node.id;
        const hasChildren = node.children.length > 0;
        const hasArticles = node.articles.length > 0;
        const articleCount = countArticles(node);
        const density = (articleCount / maxArticlesInLevel) * 100;

        return (
            <div key={node.id} className="tree-node">
                <button
                    ref={isActive ? activeNodeRef : null}
                    className={`tree-node-header ${isActive ? 'is-active' : ''}`}
                    onClick={() => onSelect(node)}
                >
                    <span
                        className={`tree-toggle ${hasChildren || hasArticles ? (isExpanded ? 'is-open' : '') : 'is-placeholder'}`}
                        onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
                    >
                        {(hasChildren || hasArticles) && <ChevronRight size={14} />}
                    </span>
                    <span className="tree-node-label">
                        {(() => {
                            // Le SEUL badge de formatNodeLabel, jamais un repli sur le type : il est vide
                            // exprès quand l'intitulé dit déjà le niveau (« Préambule ») ou pour une division
                            // sans numéro ; le type brut affichait « DIVISION » et « PRÉAMBULE Préambule ».
                            // Même règle dans api/render.js (arbreHtmlSsr) et CodePage (cartes de structure).
                            const { badge, label } = formatNodeLabel(node);
                            return <>
                                <span className="node-type">{badge}</span>
                                <span className="node-name" title={label}>{label}</span>
                            </>;
                        })()}
                        {node.note && (
                            <span
                                className="tree-nota"
                                title={node.note}
                                role="note"
                                aria-label={`Note : ${node.note}`}
                                onClick={(e) => e.stopPropagation()}
                            >!</span>
                        )}
                    </span>
                    <span className="tree-badge">{articleCount}</span>
                </button>

                {/* Density bar */}
                <div className="tree-density-bar">
                    <div className="tree-density-fill" style={{ width: `${density}%` }} />
                </div>

                {/* initial={false} : une branche DÉJÀ ouverte au premier rendu (chemin de l'article
                    consulté) s'affiche à sa hauteur, sans animation. Sinon, au moment où la page
                    amène le nœud actif dans la colonne, la branche mesure encore 0 et le
                    défilement visait à côté. */}
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            // ⚠️ Le débordement est masqué PENDANT l'animation seulement : sinon les
                            // pastilles recouvraient les titres suivants le temps du dépliage (et
                            // durablement quand le navigateur suspend l'animation). Une fois ouvert,
                            // il redevient visible, sans quoi l'anneau de focus clavier des nœuds
                            // imbriqués était rogné (revue du 02/10/2026).
                            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Sous-divisions et pastilles d'articles, dans l'ordre de lecture : un
                                article rattaché au chapitre AVANT sa première section s'affiche
                                avant elle (cf. `segmentsNoeud`). */}
                            {segmentsNoeud(node).map((seg, i) => seg.kind === 'divisions' ? (
                                <div key={`d${i}`} className="tree-children">
                                    {seg.nodes.map(ch => renderTreeNode(ch, depth + 1))}
                                </div>
                            ) : (
                                <div key={`a${i}`} className="tree-articles">
                                    {seg.articles.map(art => (
                                        <Link
                                            key={art.id}
                                            to={urlArticle(slug || '', art.slug)}
                                            className={`tree-article-chip ${activeArticleSlug && art.slug === activeArticleSlug ? 'is-active' : ''} ${(art.status === 'abrogé' || art.is_active === false) ? 'is-abroge' : ''}`}
                                            title={(art.status === 'abrogé' || art.is_active === false) ? 'Article abrogé' : undefined}
                                        >
                                            {articleLabel(art)}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="tree-root">
            {nodes.map(node => renderTreeNode(node))}
        </div>
    );
};

export default CodeNavTree;
