import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Loader2, BookOpen, ChevronRight, Building, Calendar, FileText } from 'lucide-react';
import './DoctrinePage.css';


interface DoctrineItem {
    id: string;
    slug: string;
    numero: string;
    annee: number;
    date: string;
    service_emetteur: string;
    reference_complete: string;
    objet: string;
}

// Colonnes teaser servies à tous (anon inclus). content_raw est EXCLU : l'anon n'a
// plus le privilège de le lire (migration doctrine_gate_content_raw_columns) ; le corps
// est lu sur la page détail (/doctrine-fiscale/:slug), à la demande, pour un connecté.
const TEASER_COLUMNS = 'id, slug, numero, annee, date, service_emetteur, reference_complete, objet, destinataire, signataire';

const DoctrinePage: React.FC = () => {
    const [doctrines, setDoctrines] = useState<DoctrineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchDoctrines();
    }, []);

    const fetchDoctrines = async () => {
        try {
            const { data, error } = await supabase
                .from('doctrine')
                .select(TEASER_COLUMNS)
                .order('annee', { ascending: false })
                .order('date', { ascending: false });

            if (error) throw error;
            setDoctrines(data || []);
        } catch (error) {
            console.error('Error fetching doctrines:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDoctrines = useMemo(() => {
        if (!searchQuery) return doctrines;
        const query = searchQuery.toLowerCase();
        return doctrines.filter(d =>
            (d.objet && d.objet.toLowerCase().includes(query)) ||
            (d.numero && d.numero.toLowerCase().includes(query)) ||
            (d.reference_complete && d.reference_complete.toLowerCase().includes(query))
        );
    }, [doctrines, searchQuery]);

    // La date est parfois absente du champ `date` mais TOUJOURS présente dans la
    // référence (« … DU 18 SEPTEMBRE 2009 ») → on la récupère là en repli.
    const MOIS_FR: Record<string, number> = {
        janvier: 0, fevrier: 1, 'février': 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, aout: 7, 'août': 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'décembre': 11,
    };
    const formatDate = (dateStr?: string | null, ref?: string | null) => {
        let d = dateStr ? new Date(dateStr) : null;
        if ((!d || isNaN(d.getTime())) && ref) {
            // Date dans la référence, après « le » ou « du ». Les extractions PDF
            // ajoutent des césures (« 200 4 », « novembr e ») → on retire TOUS les
            // espaces dans la zone date puis on découpe jour + mois + année.
            const m = ref.match(/\b(?:le|du)\s+(\d[\s\dA-Za-zÀ-ÿ]{3,40})/i);
            if (m) {
                const compact = m[1].replace(/\s+/g, '');
                const mm = compact.match(/^(\d{1,2})([A-Za-zÀ-ÿ]+?)(\d{4})/);
                if (mm) {
                    const mo = MOIS_FR[mm[2].toLowerCase()];
                    if (mo != null) d = new Date(Number(mm[3]), mo, Number(mm[1]));
                }
            }
        }
        if (!d || isNaN(d.getTime())) return 'Date inconnue';
        return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="doctrine-page">
            <header className="doctrine-hero">
                <div className="doctrine-hero__container">
                    <div className="doctrine-hero__emblem">
                        <BookOpen size={40} strokeWidth={1.5} />
                    </div>
                    <h1>Doctrine Fiscale</h1>
                    <p>Accédez à l'intégralité des circulaires, notes et lettres de la DGID.</p>

                    <div className="doctrine-search">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher par objet, référence ou numéro..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <section className="doctrine-content">
                {loading ? (
                    <div className="doctrine-loading">
                        <Loader2 size={40} className="spinner" />
                        <p>Chargement de la doctrine fiscale...</p>
                    </div>
                ) : (
                    <div className="doctrine-list">
                        {filteredDoctrines.map((item) => (
                            <Link
                                key={item.id}
                                to={`/doctrine-fiscale/${item.slug}`}
                                className="doctrine-card"
                            >
                                <div className="doctrine-card__summary">
                                    <div className="doctrine-card__header">
                                        <div className="doctrine-card__meta">
                                            <span className="doctrine-card__date">
                                                <Calendar size={14} />
                                                {formatDate(item.date, item.reference_complete)}
                                            </span>
                                            <span>•</span>
                                            <span className="doctrine-card__ref">
                                                {item.reference_complete || `Lettre n° ${item.numero}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="doctrine-card__body">
                                        <h3>{item.objet || "Sans objet"}</h3>
                                    </div>

                                    <div className="doctrine-card__footer">
                                        <div className="doctrine-card__service">
                                            <Building size={14} />
                                            <span>{item.service_emetteur || "DGID"}</span>
                                        </div>
                                        <div className="doctrine-card__action">
                                            Lire la lettre
                                            <ChevronRight size={16} className="doctrine-card__chevron" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {filteredDoctrines.length === 0 && (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
                                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <h3>Aucune doctrine trouvée</h3>
                                <p>Essayez de modifier vos termes de recherche.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default DoctrinePage;
