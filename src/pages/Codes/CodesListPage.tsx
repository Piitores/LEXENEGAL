import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
    Scale, BookOpen, Users, Building, Briefcase, Radio, Pickaxe,
    FileText, ChevronRight, Loader2, Gavel, Landmark,
    Search, Map, Vote
} from 'lucide-react';
import './CodesListPage.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LawCode {
    id: string;
    name: string;
    slug: string;
    short_name: string;
    description: string;
    articles_count?: number;
    category?: string;
}

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
    'Droit de la Communication': {
        icon: Radio,
        color: '#8B5CF6',
        description: 'Presse écrite, audiovisuel, presse en ligne'
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
    }
};

// Association slug -> thème
const CODE_TO_THEME: Record<string, string> = {
    'code-travail': 'Droit du Travail',
    'code-securite-sociale-senegal': 'Droit du Travail',  // Code de la Sécurité Sociale
    'code-famille': 'Droit de la Famille',  // Code de la Famille
    'code-de-la-famille': 'Droit de la Famille', // Code de la Famille (nouveau slug)
    'code-civil': 'Droit Civil et Commercial',
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
    'code-de-la-presse': 'Droit de la Communication',  // Code de la Presse
    'code-minier': 'Droit Minier',  // Code Minier
    'code-electoral': 'Droit Électoral', // Code Électoral
    'code-de-l-urbanisme': "Droit de l'Urbanisme", // Code de l'Urbanisme
    'au-suretes': 'Droit OHADA',  // Acte Uniforme Sûretés
    'au-commercial': 'Droit OHADA',  // Acte Uniforme Droit Commercial Général
    'au-recouvrement': 'Droit OHADA'  // Acte Uniforme Recouvrement (à venir)
};

const CodesListPage: React.FC = () => {
    const [codes, setCodes] = useState<LawCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
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
                    articles:articles(count)
                `)
                .order('title');

            if (error) throw error;

            const allowedSlugs = ['code-travail', 'code-securite-sociale-senegal', 'code-general-impots', 'code-de-procedure-penale'];
            const transformedCodes: LawCode[] = (codesData || [])
                .filter((code: any) => allowedSlugs.includes(code.slug))
                .map((code: any) => ({
                id: code.id,
                name: code.title,
                slug: code.slug,
                short_name: code.short_title || code.title,
                description: code.description || '',
                // Use slug-to-theme mapping for proper categorization
                category: CODE_TO_THEME[code.slug] || 'Droit Civil',
                articles_count: code.articles?.[0]?.count || 0
            }));

            setCodes(transformedCodes);
        } catch (err) {
            console.error('Error fetching codes:', err);
        } finally {
            setLoading(false);
        }
    };

    // Grouper les codes par thème
    const codesByTheme = codes.reduce((acc, code) => {
        const theme = code.category || 'Autres';
        if (!acc[theme]) acc[theme] = [];
        acc[theme].push(code);
        return acc;
    }, {} as Record<string, LawCode[]>);

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
                    <h1>Le Corpus Législatif National</h1>
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
                        /* Bento Grid par thèmes */
                        <div className="corpus-bento">
                            {Object.entries(CODE_THEMES).map(([themeName, themeData]) => {
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
                    )}
                </div>
            </section>

            {/* Stats */}
            <section className="corpus-stats">
                <div className="corpus-container">
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-value">{codes.length}</span>
                            <span className="stat-label">Codes disponibles</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">
                                {codes.reduce((sum, c) => sum + (c.articles_count || 0), 0)}
                            </span>
                            <span className="stat-label">Articles indexés</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">6</span>
                            <span className="stat-label">Branches du droit</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

// Composant Card pour un code
const CodeCard: React.FC<{ code: LawCode }> = ({ code }) => {
    const theme = CODE_THEMES[code.category as keyof typeof CODE_THEMES] || CODE_THEMES['Droit Civil et Commercial'];
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
