// Arbre de navigation d'un code (Titre > Chapitre > Section + pastilles d'articles).
// Partagé entre la page Code et la page Article - rendu et classes CSS identiques.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { articleLabel } from '../../lib/articleLabel';
import { HierarchyNode, countArticles, computeMaxArticlesInLevel, formatNodeLabel, NODE_KIND } from '../../lib/codeTree';
import './CodeNavTree.css';

interface CodeNavTreeProps {
    nodes: HierarchyNode[];
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
                            const { badge, label } = formatNodeLabel(node);
                            return <>
                                <span className="node-type">{badge || NODE_KIND[node.type] || node.type}</span>
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

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Children */}
                            {hasChildren && (
                                <div className="tree-children">
                                    {node.children.map(ch => renderTreeNode(ch, depth + 1))}
                                </div>
                            )}

                            {/* Article chips */}
                            {hasArticles && (
                                <div className="tree-articles">
                                    {node.articles.map(art => (
                                        <Link
                                            key={art.id}
                                            to={`/code/${slug}/${art.slug}`}
                                            className={`tree-article-chip ${activeArticleSlug && art.slug === activeArticleSlug ? 'is-active' : ''} ${(art.status === 'abrogé' || art.is_active === false) ? 'is-abroge' : ''}`}
                                            title={(art.status === 'abrogé' || art.is_active === false) ? 'Article abrogé' : undefined}
                                        >
                                            {articleLabel(art)}
                                        </Link>
                                    ))}
                                </div>
                            )}
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
