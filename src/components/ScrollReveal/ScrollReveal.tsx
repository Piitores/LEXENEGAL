import React, { useRef, useState, useEffect } from 'react';
import { useScroll, useTransform, motion, MotionValue } from 'framer-motion';
import {
    Sparkles, Scale, BookOpen, Landmark,
    Briefcase, ChevronDown, ChevronRight, Search
} from 'lucide-react';
import { fetchPublicStats, formatFr, libelleDecisions, type PublicStats } from '../../lib/homeStats';
import './ScrollReveal.css';

/* ─── Header ─── */

const RevealHeader: React.FC<{ translate: number | MotionValue<number> }> = ({ translate }) => (
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
            Jurisprudence et textes fondateurs - deux piliers, une seule plateforme.
        </p>
    </motion.div>
);

const RevealCard: React.FC<{
    rotate: number | MotionValue<number>;
    scale: number | MotionValue<number>;
    children: React.ReactNode;
}> = ({ rotate, scale, children }) => (
    <motion.div style={{ rotateX: rotate, scale }} className="scroll-reveal__card">
        <div className="scroll-reveal__card-inner">{children}</div>
    </motion.div>
);

/* ═══════════════════════════════════════════════════════════════════
   LEFT PANEL - Jurisprudence Filter UI  (données réelles)
   ═══════════════════════════════════════════════════════════════════ */

const CHAMBRES = ['Sociale', 'Civile', 'Pénale', 'Commerciale'];

/**
 * Compteur vivant partagé par les deux piliers de la démo. Les valeurs étaient
 * codées en dur (« 11 325 décisions », « 11 codes ») et périmées ; `fetchPublicStats`
 * est mis en cache au niveau du module, donc un seul appel par chargement de page.
 */
const useCompteurs = () => {
    const [s, setS] = useState<PublicStats | null>(null);
    useEffect(() => {
        let vivant = true;
        fetchPublicStats().then((v) => { if (vivant) setS(v); });
        return () => { vivant = false; };
    }, []);
    return s;
};

const JurisprudencePanel: React.FC = () => {
    const [activeChambres, setActiveChambres] = useState(['Sociale']);
    const stats = useCompteurs();

    const toggleChambre = (c: string) =>
        setActiveChambres(prev =>
            prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
        );

    return (
        <div className="pillar pillar--juris">
            <div className="pillar__header">
                <Scale size={13} />
                <span>Jurisprudence</span>
                <span className="pillar__count">{stats ? `${libelleDecisions(stats)} décisions` : ''}</span>
            </div>

            {/* Search bar */}
            <div className="pillar__search">
                <Search size={12} />
                <span className="pillar__search-text">licenciement irrégulier...</span>
                <span className="pillar__search-cursor" />
            </div>

            {/* Juridiction */}
            <div className="filter-block">
                <div className="filter-block__label">Juridiction</div>
                <div className="filter-select">
                    <Landmark size={11} />
                    <span>Cour suprême</span>
                    <ChevronDown size={11} />
                </div>
            </div>

            {/* Chambre chips */}
            <div className="filter-block">
                <div className="filter-block__label">Matière</div>
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
                    <span>2025</span>
                </div>
            </div>

            {/* Result divider */}
            <div className="result-divider">
                <span>Cour suprême · Chambre sociale</span>
            </div>

            {/* Result previews (références réelles) */}
            <div className="result-list">
                <div className="result-card result-card--active">
                    <div className="result-card__ref">Arrêt n° 24</div>
                    <div className="result-card__subject">Licenciement d'un délégué du personnel sans autorisation</div>
                    <div className="result-card__meta">
                        <span>Cour suprême · Sociale</span>
                        <span>2024</span>
                    </div>
                </div>
                <div className="result-card">
                    <div className="result-card__ref">Arrêt n° 40</div>
                    <div className="result-card__subject">Licenciement collectif - Contrôleurs (CDG)</div>
                    <div className="result-card__meta">
                        <span>Cour suprême · Sociale</span>
                        <span>2024</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   RIGHT PANEL - Code Tree Navigator  (Code du Travail réel)
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

const CodeTreePanel: React.FC = () => {
  const stats = useCompteurs();
  return (
    <div className="pillar pillar--corpus">
        <div className="pillar__header pillar__header--corpus">
            <BookOpen size={13} />
            <span>Corpus National</span>
            <span className="pillar__count">{stats ? `${formatFr(stats.codes)} codes` : ''}</span>
        </div>

        {/* Code selector */}
        <div className="code-selector">
            <Briefcase size={12} />
            <div className="code-selector__info">
                <span className="code-selector__name">Code du Travail</span>
                <span className="code-selector__meta">Loi n° 97-17 · code consolidé</span>
            </div>
            <ChevronDown size={11} />
        </div>

        {/* Tree structure (réelle) */}
        <div className="code-tree">
            <TreeItem label="Titre II - Des syndicats professionnels" level={1} />
            <TreeItem label="Titre III - Du contrat de travail" level={1} expanded>
                <TreeItem label="Chapitre I - Dispositions générales" level={2} count="6 art." />
                <TreeItem label="Chapitre II - De l'engagement à l'essai" level={2} count="5 art." />
                <TreeItem label="Chapitre III - Du contrat à durée déterminée" level={2} count="8 art." />
                <TreeItem label="Chapitre IV - Du contrat à durée indéterminée" level={2} expanded active>
                    <TreeItem label="Art. L.49 - Définition du CDI" level={3} />
                    <TreeItem label="Art. L.50 - Résiliation & préavis" level={3} />
                    <TreeItem label="Art. L.51 - Licenciement irrégulier" level={3} active />
                </TreeItem>
            </TreeItem>
            <TreeItem label="Titre IV - De l'apprentissage et la formation" level={1} />
        </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   DUAL PILLAR MOSAIC - convergence des deux piliers au scroll
   ═══════════════════════════════════════════════════════════════════ */

interface MosaicProps {
    animate: boolean;
    leftX: MotionValue<number>;
    rightX: MotionValue<number>;
    opacity: MotionValue<number>;
    hubScale: MotionValue<number>;
    connector: MotionValue<number>;
}

/**
 * ⚠️ Quand l'animation est désactivée (mobile, ou « réduire les animations »),
 * il faut passer des valeurs de repos EXPLICITES et non `undefined`.
 *
 * Bug corrigé le 2026-07-27 : `isMobile` n'est calculé que dans un `useEffect`,
 * donc au PREMIER rendu il vaut `false` → l'animation démarrait et framer-motion
 * inscrivait `opacity: 0` dans le DOM (état de départ au défilement 0). L'effet
 * passait ensuite `isMobile` à true, le style devenait `undefined`… mais
 * **l'`opacity: 0` déjà écrite restait**, et plus rien ne la remettait à 1.
 * Résultat sur mobile : les deux panneaux invisibles, on ne voyait que le fond
 * vert de la carte. Vérifié dans le DOM : `style="opacity: 0; transform: none;"`.
 */
const AU_REPOS = { x: 0, opacity: 1 } as const;

const DualPillarMosaic: React.FC<MosaicProps> = ({ animate, leftX, rightX, opacity, hubScale, connector }) => (
    <div className="dual-pillar">
        <motion.div className="pillar-wrap" style={animate ? { x: leftX, opacity } : AU_REPOS}>
            <JurisprudencePanel />
        </motion.div>

        <div className="dual-pillar__divider">
            <motion.div className="dual-pillar__connector" style={animate ? { scaleX: connector } : { scaleX: 1 }} />
            <motion.div className="dual-pillar__hub" style={animate ? { scale: hubScale } : { scale: 1 }}>
                <div className="dual-pillar__hub-ring" />
                <div className="dual-pillar__hub-core"><span>L</span></div>
            </motion.div>
        </div>

        <motion.div className="pillar-wrap" style={animate ? { x: rightX, opacity } : AU_REPOS}>
            <CodeTreePanel />
        </motion.div>
    </div>
);

/* ─── Main Component ─── */

const ScrollReveal: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Initialisation PAREsseuse depuis la fenêtre : sans cela, le premier rendu
    // croyait être sur ordinateur et lançait l'animation (cf. AU_REPOS ci-dessus).
    // `typeof window` : le rendu serveur (api/render.js) n'a pas de fenêtre.
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth <= 768,
    );
    const [reduced, setReduced] = useState(
        () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const applyReduced = () => setReduced(!!mq?.matches);
        applyReduced();
        mq?.addEventListener?.('change', applyReduced);
        return () => {
            window.removeEventListener('resize', checkMobile);
            mq?.removeEventListener?.('change', applyReduced);
        };
    }, []);

    const { scrollYProgress } = useScroll({ target: containerRef });
    const rotate = useTransform(scrollYProgress, [0, 1], [18, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.78, 0.94] : [1.04, 1]);
    const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

    // Convergence : les deux piliers arrivent écartés/estompés puis se rejoignent.
    const leftX = useTransform(scrollYProgress, [0, 0.6], [-70, 0]);
    const rightX = useTransform(scrollYProgress, [0, 0.6], [70, 0]);
    const pillarsOpacity = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
    const hubScale = useTransform(scrollYProgress, [0.4, 0.78], [0.4, 1]);
    const connector = useTransform(scrollYProgress, [0.45, 0.85], [0, 1]);

    const animate = !isMobile && !reduced;

    return (
        <div className="scroll-reveal" ref={containerRef}>
            <div className="scroll-reveal__inner">
                <RevealHeader translate={reduced ? 0 : translate} />
                <RevealCard rotate={reduced ? 0 : rotate} scale={reduced ? 1 : scale}>
                    <DualPillarMosaic
                        animate={animate}
                        leftX={leftX}
                        rightX={rightX}
                        opacity={pillarsOpacity}
                        hubScale={hubScale}
                        connector={connector}
                    />
                </RevealCard>
            </div>
        </div>
    );
};

export default ScrollReveal;
