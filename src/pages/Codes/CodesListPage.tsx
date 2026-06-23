import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Scale, BookOpen, Users, Building, Briefcase, Radio, Pickaxe,
    FileText, ChevronRight, Loader2, Gavel, Landmark,
    Search, Map, Vote, Scroll, Leaf, FolderOpen
} from 'lucide-react';
import './CodesListPage.css';


interface LawCode {
    id: string;
    name: string;
    slug: string;
    short_name: string;
    description: string;
    articles_count?: number;
    category?: string;     // = nom du THÈME (pour l'icône via CODE_THEMES) — conservé pour CodeCard
    dbCategory?: string;   // = vraie catégorie en base (code|loi|decret|ohada…) — pilote le rangement en bases
    publication_date?: string | null;  // pour le tri LODA par date
}

// Bases du hub (pilotées par la catégorie BDD `dbCategory`).
const LODA_CATEGORIES = ['loi', 'ordonnance', 'decret', 'arrete', 'circulaire'];
const COMMUNAUTAIRE_CATEGORIES = ['ohada', 'uemoa', 'cedeao'];
const LODA_TYPE_LABELS: Record<string, string> = {
    loi: 'Lois', ordonnance: 'Ordonnances', decret: 'Décrets', arrete: 'Arrêtés', circulaire: 'Circulaires',
};
const COMMUNAUTAIRE_TYPE_LABELS: Record<string, string> = {
    ohada: 'OHADA — Actes uniformes', uemoa: 'UEMOA', cedeao: 'CEDEAO',
};

// Thèmes avec leurs métadonnées
const CODE_THEMES = {
    'Droit du Travail': {
        icon: Briefcase,
        color: '#047857',
        description: 'Relations employeur-employé, contrats, licenciement'
    },
    'Droit de la Famille': {
        icon: Users,
        color: '#7C3AED',
        description: 'Mariage, filiation, succession, divorce'
    },
    'Droit Civil et Commercial': {
        icon: Scale,
        color: '#2563EB',
        description: 'Obligations, contrats, responsabilité, sociétés, commerce'
    },
    'Droit Pénal': {
        icon: Gavel,
        color: '#DC2626',
        description: 'Infractions, peines, procédure pénale'
    },
    'Droit Administratif': {
        icon: Landmark,
        color: '#0891B2',
        description: 'Administration, marchés publics, fonction publique'
    },
    'Droit du Numérique et des Communications': {
        icon: Radio,
        color: '#8B5CF6',
        description: 'Numérique, communications électroniques, presse, cybersécurité, données personnelles'
    },
    'Droit Minier': {
        icon: Pickaxe,
        color: '#B45309',
        description: 'Mines, carrières, substances minérales'
    },
    'Droit OHADA': {
        icon: BookOpen,
        color: '#059669',
        description: 'Droit des affaires harmonisé en Afrique'
    },
    'Droit Douanier et Fiscal': {
        icon: FileText,
        color: '#0369a1',
        description: 'Douanes, impôts, fiscalité des entreprises, taxes'
    },
    'Droit Électoral': {
        icon: Vote,
        color: '#D946EF',
        description: 'Élections, partis politiques, code électoral'
    },
    "Droit de l'Urbanisme": {
        icon: Map,
        color: '#F59E0B',
        description: 'Aménagement, construction, cadastre, foncier'
    },
    'Droit Constitutionnel': {
        icon: Scroll,
        color: '#4338CA',
        description: 'Constitution, institutions, libertés fondamentales'
    },
    "Droit de la Santé et de l'Environnement": {
        icon: Leaf,
        color: '#15803D',
        description: 'Santé publique, hygiène, médecine, environnement, ressources naturelles'
    },
    'Autres': {
        icon: FolderOpen,
        color: '#6B7280',
        description: 'Textes non encore rattachés à une branche'
    }
};

// Association slug -> thème
const CODE_TO_THEME: Record<string, string> = {
    'code-travail': 'Droit du Travail',
    'code-securite-sociale-senegal': 'Droit du Travail',  // Code de la Sécurité Sociale
    'code-famille': 'Droit de la Famille',  // Code de la Famille
    'code-de-la-famille': 'Droit de la Famille', // Code de la Famille (nouveau slug)
    'code-civil': 'Droit Civil et Commercial',
    'cocc': 'Droit Civil et Commercial',  // Code des Obligations Civiles et Commerciales (slug réel en base)
    'code-des-obligations-civiles-et-commerciales': 'Droit Civil et Commercial',  // Code des Obligations Civiles et Commerciales
    'code-procedure-civile': 'Droit Civil et Commercial',  // Code de Procédure Civile
    'code-de-procedure-civile': 'Droit Civil et Commercial',  // Code de Procédure Civile (Vrai slug de la DB)
    'code-penal': 'Droit Pénal',  // Code Pénal
    'code-de-procedure-penale': 'Droit Pénal',  // Code de Procédure Pénale
    'code-commerce': 'Droit Civil et Commercial',
    'code-marches-publics': 'Droit Administratif',  // Code des Marchés Publics
    'code-administratif': 'Droit Administratif',
    'code-des-obligations-de-ladministration': 'Droit Administratif',  // COA
    'code-des-douanes': 'Droit Douanier et Fiscal', // Code des douanes
    'code-general-impots': 'Droit Douanier et Fiscal', // Code Général des Impôts (CGI)
    'code-de-la-presse': 'Droit du Numérique et des Communications',  // Code de la Presse
    'code-communications-electroniques': 'Droit du Numérique et des Communications',  // Code des communications électroniques
    'loi-transactions-electroniques': 'Droit du Numérique et des Communications',  // Loi 2008-08 transactions électroniques (LODA)
    'loi-cybercriminalite': 'Droit du Numérique et des Communications',  // Loi cybercriminalité (LODA)
    'loi-protection-donnees-personnelles': 'Droit du Numérique et des Communications',  // Loi protection des données (LODA)
    'code-de-l-environnement': "Droit de la Santé et de l'Environnement",  // Code de l'Environnement
    'loi-83-71-code-hygiene': "Droit de la Santé et de l'Environnement",   // Code de l'Hygiène
    'loi-66-69-exercice-medecine': "Droit de la Santé et de l'Environnement", // Exercice de la médecine (LODA)
    'constitution-senegal': 'Droit Constitutionnel',  // Constitution — branche autonome
    'code-minier': 'Droit Minier',  // Code Minier
    'code-electoral': 'Droit Électoral', // Code Électoral
    'loi-2024-09-amnistie': 'Droit Pénal', // Loi d'amnistie 2024 (base LODA, icône Pénal)
    'code-de-l-urbanisme': "Droit de l'Urbanisme", // Code de l'Urbanisme
    'au-suretes': 'Droit OHADA',  // Acte Uniforme Sûretés
    'au-commercial': 'Droit OHADA',  // Acte Uniforme Droit Commercial Général
    'au-recouvrement': 'Droit OHADA'  // Acte Uniforme Recouvrement (à venir)
};

const CodesListPage: React.FC = () => {
    const [codes, setCodes] = useState<LawCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // Le Droit communautaire (OHADA) est désormais une entrée AUTONOME du header
    // (hors Corpus National) → plus d'onglet « communautaire » dans ce hub.
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
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        try {
            const { data: codesData, error } = await supabase
                .from('laws_and_codes')
                .select(`
                    id,
                    title,
                    slug,
                    short_title,
                    description,
                    category,
                    is_active,
                    publication_date,
                    articles:articles(count)
                `)
                .eq('is_active', true)   // visibilité pilotée par l'interrupteur "publié" en base
                .order('title');

            if (error) throw error;

            // On ne filtre plus par liste blanche : on affiche tous les textes publiés (is_active),
            // rangés par base via leur vraie catégorie BDD (dbCategory).
            const transformedCodes: LawCode[] = (codesData || []).map((code: any) => {
                const dbCat = code.category || 'code';
                // Le mapping slug->branche s'applique à TOUS les textes (codes ET LODA) ;
                // défaut « Autres » (sauf communautaire -> OHADA).
                const themeName = CODE_TO_THEME[code.slug]
                    || (COMMUNAUTAIRE_CATEGORIES.includes(dbCat) ? 'Droit OHADA' : 'Autres');
                return {
                    id: code.id,
                    name: code.title,
                    slug: code.slug,
                    short_name: code.short_title || code.title,
                    description: code.description || '',
                    category: themeName,   // thème (icône)
                    dbCategory: dbCat,     // catégorie réelle (rangement)
                    articles_count: code.articles?.[0]?.count || 0,
                    publication_date: code.publication_date || null,
                };
            });

            setCodes(transformedCodes);
        } catch (err) {
            console.error('Error fetching codes:', err);
        } finally {
            setLoading(false);
        }
    };

    // Répartition par BASE (via la catégorie réelle BDD)
    const corpusCodes = codes.filter((c) => c.dbCategory === 'code');
    const lodaTextes = codes.filter((c) => LODA_CATEGORIES.includes(c.dbCategory || ''));
    const communautaireTextes = codes.filter((c) => COMMUNAUTAIRE_CATEGORIES.includes(c.dbCategory || ''));

    // Corpus : grouper les CODES par thème (la grille "bento")
    const codesByTheme = corpusCodes.reduce((acc, code) => {
        const theme = code.category || 'Autres';
        if (!acc[theme]) acc[theme] = [];
        acc[theme].push(code);
        return acc;
    }, {} as Record<string, LawCode[]>);

    // Rend une base "liste" (LODA, Communautaire) : groupes par type, fiches CodeCard.
    const renderBaseListe = (textes: LawCode[], labels: Record<string, string>, ordre: string[]) => (
        ordre.filter((t) => textes.some((x) => x.dbCategory === t)).map((t) => (
            <div className="loda-group" key={t}>
                <h3 className="loda-group__titre">{labels[t]}</h3>
                <div className="codes-list">
                    {textes.filter((x) => x.dbCategory === t).map((code) => (
                        <CodeCard key={code.id} code={code} />
                    ))}
                </div>
            </div>
        ))
    );

    // --- Base LODA réorganisée : filtre branche + sections (type) repliables + tri ---
    const lodaNum = (s: string) => { const m = s.match(/n[°o]\s*([\d-]+)/i); return m ? m[1] : ''; };
    const lodaSorters: Record<string, (a: LawCode, b: LawCode) => number> = {
        date: (a, b) => (b.publication_date || '0').localeCompare(a.publication_date || '0'),
        numero: (a, b) => lodaNum(a.name).localeCompare(lodaNum(b.name), 'fr', { numeric: true }),
        alpha: (a, b) => a.name.localeCompare(b.name, 'fr'),
    };
    const renderLodaBase = () => {
        const brancheCount: Record<string, number> = {};
        lodaTextes.forEach((c) => { const b = c.category || 'Autres'; brancheCount[b] = (brancheCount[b] || 0) + 1; });
        const branches = Object.keys(brancheCount).sort((a, b) => a.localeCompare(b, 'fr'));
        const filtered = lodaBranche ? lodaTextes.filter((c) => (c.category || 'Autres') === lodaBranche) : lodaTextes;
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
                        {branches.map((b) => (
                            <button key={b} className={`loda-chip ${lodaBranche === b ? 'actif' : ''}`}
                                onClick={() => setLodaBranche(lodaBranche === b ? null : b)}>
                                {b} <span className="loda-chip__n">{brancheCount[b]}</span>
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
                                    {items.map((code) => <CodeCard key={code.id} code={code} />)}
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
                                    <CodeCard key={code.id} code={code} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Bases en ONGLETS : Codes consolidés / LODA / Droit communautaire / JORS */
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
                            {Object.entries(CODE_THEMES).filter(([n]) => n !== 'Droit OHADA').map(([themeName, themeData]) => {
                                const themeCodes = codesByTheme[themeName] || [];
                                const IconComponent = themeData.icon;

                                return (
                                    <div
                                        key={themeName}
                                        className={`theme-card ${themeCodes.length > 0 ? 'theme-card--active' : 'theme-card--coming'}`}
                                        style={{ '--theme-color': themeData.color } as React.CSSProperties}
                                    >
                                        <div className="theme-card__header">
                                            <div className="theme-card__icon">
                                                <IconComponent size={28} strokeWidth={1.5} />
                                            </div>
                                            <div className="theme-card__info">
                                                <h3>{themeName}</h3>
                                                <p>{themeData.description}</p>
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

// Composant Card pour un code
const CodeCard: React.FC<{ code: LawCode }> = ({ code }) => {
    const theme = CODE_THEMES[code.category as keyof typeof CODE_THEMES] || CODE_THEMES['Autres'];
    const IconComponent = theme.icon;
    const linkPath = code.slug === 'doctrine-fiscale' ? '/doctrine-fiscale' : `/code/${code.slug}`;

    return (
        <Link to={linkPath} className="code-card-v2">
            <div className="code-card-v2__icon" style={{ background: `${theme.color}15`, color: theme.color }}>
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

export default CodesListPage;
