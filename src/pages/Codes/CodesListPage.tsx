import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Scale, BookOpen, Users, Building, Briefcase, Radio, Pickaxe,
    FileText, ChevronRight, Loader2, Gavel, Landmark,
    Search, Map, Vote, Scroll, Leaf, FolderOpen, Car
} from 'lucide-react';
import './CodesListPage.css';

// Résolution du nom d'icône (colonne branches.icon) -> composant lucide.
// Seule chose qui reste au front : une icône est un composant React, pas une valeur BDD.
const ICONS: Record<string, React.ComponentType<any>> = {
    Scale, BookOpen, Users, Building, Briefcase, Radio, Pickaxe,
    FileText, Gavel, Landmark, Map, Vote, Scroll, Leaf, FolderOpen, Car,
};
const iconFor = (name?: string): React.ComponentType<any> => ICONS[name || ''] || FolderOpen;

interface Branche {
    slug: string;
    label: string;
    icon: string;
    color: string;
    description: string | null;
    ordre: number;
}

interface LawCode {
    id: string;
    name: string;
    slug: string;
    short_name: string;
    description: string;
    brancheSlug: string;   // 'autres' si non rattaché
    dbCategory: string;    // vraie catégorie BDD (code|loi|decret|ohada…) — pilote le rangement en bases
    articles_count?: number;
    publication_date?: string | null;  // pour le tri LODA par date
}

// Bases du hub (pilotées par la catégorie BDD `dbCategory`).
const LODA_CATEGORIES = ['loi', 'ordonnance', 'decret', 'arrete', 'circulaire'];
const COMMUNAUTAIRE_CATEGORIES = ['ohada', 'uemoa', 'cedeao'];
const LODA_TYPE_LABELS: Record<string, string> = {
    loi: 'Lois', ordonnance: 'Ordonnances', decret: 'Décrets', arrete: 'Arrêtés', circulaire: 'Circulaires',
};

// Branche de repli affichée si un texte n'a pas encore de branche (LODA en cours de triage).
const FALLBACK_BRANCHE: Branche = {
    slug: 'autres', label: 'Autres', icon: 'FolderOpen',
    color: '#6B7280', description: 'Textes non encore rattachés à une branche', ordre: 99,
};

// Composant Card pour un texte (reçoit sa branche résolue -> icône + couleur)
const CodeCard: React.FC<{ code: LawCode; branche: Branche }> = ({ code, branche }) => {
    const IconComponent = iconFor(branche.icon);
    const linkPath = code.slug === 'doctrine-fiscale' ? '/doctrine-fiscale' : `/code/${code.slug}`;

    return (
        <Link to={linkPath} className="code-card-v2">
            <div className="code-card-v2__icon" style={{ background: `${branche.color}15`, color: branche.color }}>
                <IconComponent size={24} />
            </div>
            <div className="code-card-v2__content">
                <h3>{code.short_name}</h3>
                <p>{code.name}</p>
                <span className="code-card-v2__meta">{code.articles_count} articles</span>
            </div>
            <ChevronRight size={18} className="code-card-v2__arrow" />
        </Link>
    );
};

const CodesListPage: React.FC = () => {
    const [codes, setCodes] = useState<LawCode[]>([]);
    const [branches, setBranches] = useState<Branche[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Le Droit communautaire (OHADA) est une entrée AUTONOME du header (hors Corpus National).
    const [searchParams] = useSearchParams();
    const [activeBase, setActiveBase] = useState<'codes' | 'loda'>(
        searchParams.get('base') === 'loda' ? 'loda' : 'codes'
    );
    // Base LODA : filtre par branche, sections (par type) repliables, tri.
    const [lodaBranche, setLodaBranche] = useState<string | null>(null);
    const [lodaExpanded, setLodaExpanded] = useState<Set<string>>(new Set());
    const [lodaSort, setLodaSort] = useState<'date' | 'numero' | 'alpha'>('date');
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [branchesRes, codesRes] = await Promise.all([
                supabase.from('branches').select('slug,label,icon,color,description,ordre').order('ordre'),
                supabase
                    .from('laws_and_codes')
                    .select(`
                        id,
                        title,
                        slug,
                        short_title,
                        description,
                        category,
                        branche_slug,
                        is_active,
                        publication_date,
                        articles:articles(count)
                    `)
                    .eq('is_active', true)   // visibilité pilotée par l'interrupteur "publié" en base
                    .order('title'),
            ]);

            if (branchesRes.error) throw branchesRes.error;
            if (codesRes.error) throw codesRes.error;

            setBranches((branchesRes.data as Branche[]) || []);

            // La branche vient désormais de la base (branche_slug) — plus de mapping codé en dur.
            const transformedCodes: LawCode[] = (codesRes.data || []).map((code: any) => ({
                id: code.id,
                name: code.title,
                slug: code.slug,
                short_name: code.short_title || code.title,
                description: code.description || '',
                brancheSlug: code.branche_slug || 'autres',
                dbCategory: code.category || 'code',
                articles_count: code.articles?.[0]?.count || 0,
                publication_date: code.publication_date || null,
            }));

            setCodes(transformedCodes);
        } catch (err) {
            console.error('Error fetching codes:', err);
        } finally {
            setLoading(false);
        }
    };

    const branchesMap = useMemo(
        () => Object.fromEntries(branches.map((b) => [b.slug, b])) as Record<string, Branche>,
        [branches]
    );
    const brancheMeta = (slug: string): Branche => branchesMap[slug] || branchesMap['autres'] || FALLBACK_BRANCHE;

    // Répartition par BASE (via la catégorie réelle BDD)
    const corpusCodes = codes.filter((c) => c.dbCategory === 'code');
    const lodaTextes = codes.filter((c) => LODA_CATEGORIES.includes(c.dbCategory || ''));
    const communautaireTextes = codes.filter((c) => COMMUNAUTAIRE_CATEGORIES.includes(c.dbCategory || ''));

    // Corpus : grouper les CODES par branche (grille "bento")
    const codesByBranche = corpusCodes.reduce((acc, code) => {
        (acc[code.brancheSlug] ||= []).push(code);
        return acc;
    }, {} as Record<string, LawCode[]>);

    // --- Base LODA : filtre branche + sections (type) repliables + tri ---
    const lodaNum = (s: string) => { const m = s.match(/n[°o]\s*([\d-]+)/i); return m ? m[1] : ''; };
    const lodaSorters: Record<string, (a: LawCode, b: LawCode) => number> = {
        date: (a, b) => (b.publication_date || '0').localeCompare(a.publication_date || '0'),
        numero: (a, b) => lodaNum(a.name).localeCompare(lodaNum(b.name), 'fr', { numeric: true }),
        alpha: (a, b) => a.name.localeCompare(b.name, 'fr'),
    };
    const renderLodaBase = () => {
        const brancheCount: Record<string, number> = {};
        lodaTextes.forEach((c) => { brancheCount[c.brancheSlug] = (brancheCount[c.brancheSlug] || 0) + 1; });
        const brancheSlugs = Object.keys(brancheCount)
            .sort((a, b) => brancheMeta(a).ordre - brancheMeta(b).ordre);
        const filtered = lodaBranche ? lodaTextes.filter((c) => c.brancheSlug === lodaBranche) : lodaTextes;
        const sortFn = lodaSorters[lodaSort];
        const isOpen = (t: string) => (lodaBranche ? true : lodaExpanded.has(t));
        const toggle = (t: string) => setLodaExpanded((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
        return (
            <>
                <div className="loda-filtres">
                    <div className="loda-chips">
                        <button className={`loda-chip ${!lodaBranche ? 'actif' : ''}`} onClick={() => setLodaBranche(null)}>
                            Tout <span className="loda-chip__n">{lodaTextes.length}</span>
                        </button>
                        {brancheSlugs.map((slug) => (
                            <button key={slug} className={`loda-chip ${lodaBranche === slug ? 'actif' : ''}`}
                                onClick={() => setLodaBranche(lodaBranche === slug ? null : slug)}>
                                {brancheMeta(slug).label} <span className="loda-chip__n">{brancheCount[slug]}</span>
                            </button>
                        ))}
                    </div>
                    <select className="loda-tri" value={lodaSort} onChange={(e) => setLodaSort(e.target.value as 'date' | 'numero' | 'alpha')}>
                        <option value="date">Plus récent</option>
                        <option value="numero">Numéro</option>
                        <option value="alpha">A → Z</option>
                    </select>
                </div>
                {LODA_CATEGORIES.filter((t) => filtered.some((x) => x.dbCategory === t)).map((t) => {
                    const items = filtered.filter((x) => x.dbCategory === t).sort(sortFn);
                    const open = isOpen(t);
                    return (
                        <div className={`loda-section ${open ? 'is-open' : ''}`} key={t}>
                            <button className="loda-section__head" onClick={() => toggle(t)}>
                                <ChevronRight size={16} className="loda-section__chev" />
                                <span className="loda-section__titre">{LODA_TYPE_LABELS[t] || t}</span>
                                <span className="loda-section__n">{items.length}</span>
                            </button>
                            {open && (
                                <div className="codes-list">
                                    {items.map((code) => <CodeCard key={code.id} code={code} branche={brancheMeta(code.brancheSlug)} />)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    // Filtrer les codes par recherche
    const filteredCodes = searchQuery
        ? codes.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.short_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : null;

    return (
        <div className="corpus-page">
            {/* Hero Souverain */}
            <header className="corpus-hero">
                <div className="corpus-hero__container">
                    <div className="corpus-hero__emblem">
                        <Scale size={48} strokeWidth={1} />
                    </div>
                    <h1>Corpus National</h1>
                    <p>L'intégralité des textes de loi du Sénégal, structurés, versionnés et accessibles.</p>

                    {/* Barre de recherche interne */}
                    <div className="corpus-search">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher un code, une loi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Contenu */}
            <section className="corpus-content">
                <div className="corpus-container">
                    {loading ? (
                        <div className="corpus-loading">
                            <Loader2 size={40} className="spinner" />
                            <p>Chargement du corpus...</p>
                        </div>
                    ) : filteredCodes ? (
                        /* Résultats de recherche */
                        <div className="corpus-search-results">
                            <h2>{filteredCodes.length} résultat{filteredCodes.length > 1 ? 's' : ''}</h2>
                            <div className="codes-list">
                                {filteredCodes.map(code => (
                                    <CodeCard key={code.id} code={code} branche={brancheMeta(code.brancheSlug)} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Bases en ONGLETS : Codes consolidés / LODA / JORS */
                        <>
                        <div className="bases-tabs">
                            <button className={`base-tab ${activeBase === 'codes' ? 'actif' : ''}`} onClick={() => setActiveBase('codes')}>Codes consolidés <span className="base-tab__count">{corpusCodes.length}</span></button>
                            <button className={`base-tab ${activeBase === 'loda' ? 'actif' : ''}`} onClick={() => setActiveBase('loda')}>LODA <span className="base-tab__count">{lodaTextes.length}</span></button>
                            <button className="base-tab base-tab--soon" disabled>JORS <span className="badge-soon">à venir</span></button>
                        </div>

                        {activeBase === 'codes' && (
                        <div className="base-panel">
                            <p className="base-panel__sous-titre">le droit en vigueur — codes consolidés, à jour</p>
                        <div className="corpus-bento">
                            {branches.filter((b) => b.slug !== 'autres').map((b) => {
                                const themeCodes = codesByBranche[b.slug] || [];
                                const IconComponent = iconFor(b.icon);

                                return (
                                    <div
                                        key={b.slug}
                                        className={`theme-card ${themeCodes.length > 0 ? 'theme-card--active' : 'theme-card--coming'}`}
                                        style={{ '--theme-color': b.color } as React.CSSProperties}
                                    >
                                        <div className="theme-card__header">
                                            <div className="theme-card__icon">
                                                <IconComponent size={28} strokeWidth={1.5} />
                                            </div>
                                            <div className="theme-card__info">
                                                <h3>{b.label}</h3>
                                                <p>{b.description}</p>
                                            </div>
                                        </div>

                                        {themeCodes.length > 0 ? (
                                            <div className="theme-card__codes">
                                                {themeCodes.map(code => (
                                                    <Link
                                                        key={code.id}
                                                        to={code.slug === 'doctrine-fiscale' ? '/doctrine-fiscale' : `/code/${code.slug}`}
                                                        className="theme-code-link"
                                                    >
                                                        <FileText size={16} />
                                                        <span>{code.short_name}</span>
                                                        <span className="theme-code-count">{code.articles_count} art.</span>
                                                        <ChevronRight size={14} />
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="theme-card__coming">
                                                <span>Prochainement</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                        )}

                        {activeBase === 'loda' && (
                        <div className="base-panel">
                            <p className="base-panel__sous-titre">textes source — lois, ordonnances, décrets, arrêtés &amp; circulaires (version d'origine)</p>
                            {lodaTextes.length > 0
                                ? renderLodaBase()
                                : <p className="base-vide">Aucun texte publié pour l'instant.</p>}
                        </div>
                        )}

                        </>
                    )}
                </div>
            </section>

            {/* Stats */}
            <section className="corpus-stats">
                <div className="corpus-container">
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-value">{corpusCodes.length}</span>
                            <span className="stat-label">Codes consolidés</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{lodaTextes.length + communautaireTextes.length}</span>
                            <span className="stat-label">Textes source &amp; actes</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">
                                {codes.reduce((sum, c) => sum + (c.articles_count || 0), 0)}
                            </span>
                            <span className="stat-label">Articles indexés</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default CodesListPage;
