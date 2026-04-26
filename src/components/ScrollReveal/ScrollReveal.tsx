import React, { useRef, useState, useEffect } from 'react';
import { useScroll, useTransform, motion, MotionValue } from 'framer-motion';
import {
    Sparkles, Scale, BookOpen, Landmark,
    Briefcase, ChevronDown, ChevronRight, Search
} from 'lucide-react';
import './ScrollReveal.css';

/* ─── Header ─── */

const RevealHeader: React.FC<{ translate: MotionValue<number> }> = ({ translate }) => (
    <motion.div style={{ translateY: translate }} className="scroll-reveal__header">
        <span className="scroll-reveal__badge">
            <Sparkles size={12} />
            Découvrez l'expérience
        </span>
        <h2 className="scroll-reveal__title">
            Le droit sénégalais,<br />
            <span className="text-gradient">dans toute sa diversité.</span>
        </h2>
        <p className="scroll-reveal__subtitle">
            De la première instance à la Cour suprême, de l'OHADA au Conseil constitutionnel.
            Jurisprudence et textes fondateurs — deux piliers, une seule plateforme.
        </p>
    </motion.div>
);

const RevealCard: React.FC<{
    rotate: MotionValue<number>;
    scale: MotionValue<number>;
    children: React.ReactNode;
}> = ({ rotate, scale, children }) => (
    <motion.div style={{ rotateX: rotate, scale }} className="scroll-reveal__card">
        <div className="scroll-reveal__card-inner">{children}</div>
    </motion.div>
);

/* ═══════════════════════════════════════════════════════════════════
   LEFT PANEL — Jurisprudence Filter UI
   ═══════════════════════════════════════════════════════════════════ */

const CHAMBRES = ['Sociale', 'Civile', 'Pénale', 'Commerce'];

const JurisprudencePanel: React.FC = () => {
    const [activeChambres, setActiveChambres] = useState(['Sociale']);

    const toggleChambre = (c: string) =>
        setActiveChambres(prev =>
            prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
        );

    return (
        <div className="pillar pillar--juris">
            <div className="pillar__header">
                <Scale size={13} />
                <span>Jurisprudence</span>
                <span className="pillar__count">10 000+ décisions</span>
            </div>

            {/* Search bar */}
            <div className="pillar__search">
                <Search size={12} />
                <span className="pillar__search-text">licenciement abusif...</span>
                <span className="pillar__search-cursor" />
            </div>

            {/* Juridiction */}
            <div className="filter-block">
                <div className="filter-block__label">Juridiction</div>
                <div className="filter-select">
                    <Landmark size={11} />
                    <span>Cour Suprême</span>
                    <ChevronDown size={11} />
                </div>
            </div>

            {/* Chambre chips */}
            <div className="filter-block">
                <div className="filter-block__label">Chambre</div>
                <div className="filter-chips">
                    {CHAMBRES.map(c => (
                        <button
                            key={c}
                            className={`filter-chip ${activeChambres.includes(c) ? 'filter-chip--active' : ''}`}
                            onClick={() => toggleChambre(c)}
                        >{c}</button>
                    ))}
                </div>
            </div>

            {/* Date range */}
            <div className="filter-block">
                <div className="filter-block__label">Période</div>
                <div className="filter-range">
                    <span>2000</span>
                    <div className="range-track">
                        <div className="range-fill" />
                        <div className="range-thumb range-thumb--left" />
                        <div className="range-thumb range-thumb--right" />
                    </div>
                    <span>2024</span>
                </div>
            </div>

            {/* Result count divider */}
            <div className="result-divider">
                <span>52 résultats · Chambre Sociale</span>
            </div>

            {/* Result previews */}
            <div className="result-list">
                <div className="result-card result-card--active">
                    <div className="result-card__ref">Arrêt n° 04 CS</div>
                    <div className="result-card__subject">Licenciement — Procédure irrégulière</div>
                    <div className="result-card__meta">
                        <span>Cour Suprême</span>
                        <span>2008</span>
                    </div>
                </div>
                <div className="result-card">
                    <div className="result-card__ref">Arrêt n° 17 CS</div>
                    <div className="result-card__subject">Contrat à durée déterminée — Rupture</div>
                    <div className="result-card__meta">
                        <span>Cour Suprême</span>
                        <span>2012</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   RIGHT PANEL — Code Tree Navigator
   ═══════════════════════════════════════════════════════════════════ */

interface TreeItemProps {
    label: string;
    level: 1 | 2 | 3;
    expanded?: boolean;
    active?: boolean;
    count?: string;
    children?: React.ReactNode;
}

const TreeItem: React.FC<TreeItemProps> = ({ label, level, expanded, active, count, children }) => (
    <div className={`tree-item tree-item--l${level} ${active ? 'tree-item--active' : ''}`}>
        <div className="tree-item__row">
            {level < 3
                ? <ChevronRight size={9} className={`tree-chevron ${expanded ? 'tree-chevron--open' : ''}`} />
                : <span className="tree-dot" />
            }
            <span className="tree-item__label">{label}</span>
            {count && <span className="tree-item__count">{count}</span>}
        </div>
        {expanded && children && (
            <div className="tree-item__children">{children}</div>
        )}
    </div>
);

const CodeTreePanel: React.FC = () => (
    <div className="pillar pillar--corpus">
        <div className="pillar__header pillar__header--corpus">
            <BookOpen size={13} />
            <span>Corpus National</span>
            <span className="pillar__count">10 codes</span>
        </div>

        {/* Code selector */}
        <div className="code-selector">
            <Briefcase size={12} />
            <div className="code-selector__info">
                <span className="code-selector__name">Code du Travail</span>
                <span className="code-selector__meta">Loi n° 97-17 · 389 articles</span>
            </div>
            <ChevronDown size={11} />
        </div>

        {/* Tree structure */}
        <div className="code-tree">
            <TreeItem label="Titre I — Généralités" level={1} count="12 art." />
            <TreeItem label="Titre II — Contrat de travail" level={1} expanded>
                <TreeItem label="Chapitre 1 — Formation" level={2} />
                <TreeItem label="Chapitre 2 — Exécution du contrat" level={2} />
                <TreeItem label="Chapitre 3 — Rupture" level={2} expanded active>
                    <TreeItem label="Art. L.51 — Résiliation d'accord parties" level={3} />
                    <TreeItem label="Art. L.52 — Licenciement individuel" level={3} active />
                    <TreeItem label="Art. L.53 — Préavis légal" level={3} />
                </TreeItem>
            </TreeItem>
            <TreeItem label="Titre III — Contrats spéciaux" level={1} count="24 art." />
            <TreeItem label="Titre IV — Conditions de travail" level={1} count="31 art." />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════
   DUAL PILLAR MOSAIC — Two-panel layout
   ═══════════════════════════════════════════════════════════════════ */

const DualPillarMosaic: React.FC = () => (
    <div className="dual-pillar">
        <JurisprudencePanel />

        <div className="dual-pillar__divider">
            <div className="dual-pillar__hub">
                <div className="dual-pillar__hub-ring" />
                <div className="dual-pillar__hub-core"><span>L</span></div>
            </div>
        </div>

        <CodeTreePanel />
    </div>
);

/* ─── Main Component ─── */

const ScrollReveal: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const { scrollYProgress } = useScroll({ target: containerRef });
    const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.7, 0.9] : [1.05, 1]);
    const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

    return (
        <div className="scroll-reveal" ref={containerRef}>
            <div className="scroll-reveal__inner">
                <RevealHeader translate={translate} />
                <RevealCard rotate={rotate} scale={scale}>
                    <DualPillarMosaic />
                </RevealCard>
            </div>
        </div>
    );
};

export default ScrollReveal;
