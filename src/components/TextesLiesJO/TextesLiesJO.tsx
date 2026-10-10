import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { urlTexte } from '../../lib/urls';
import './TextesLiesJO.css';

/**
 * Bloc « Textes liés » (graphe des textes, étape 3 du plan validé le 10/10/2026) : actes du Journal officiel qui
 * modifient, complètent, abrogent, appliquent, visent ou citent l'article (ou le code). Source : legal_edge,
 * source = 'jo-graphe-2026-10' (liens lus deux fois et arbitrés à l'image du J.O.). Replié par défaut, comme
 * Légifrance. Lien cliquable SEULEMENT si le texte est publié chez nous (meta.slug_texte) : jamais de lien mort ;
 * sinon référence J.O. en clair (seule provenance citable). Rien à afficher → rien n'est rendu.
 */
interface Arete { src_id: string; relation: string; meta: Meta | null }
interface Meta { nature?: string; numero?: string; date?: string; intitule?: string; jo_numero?: string; jo_date?: string; slug_texte?: string }

const GROUPES: { titre: string; relations: string[] }[] = [
    { titre: 'Modifié par', relations: ['modifie', 'abroge_remplace'] },
    { titre: 'Complété par', relations: ['complete'] },
    { titre: 'Abrogé par', relations: ['abroge'] },
    { titre: "Textes d'application", relations: ['texte_application'] },
    { titre: 'Visé par', relations: ['vise'] },
    { titre: 'Cité par', relations: ['renvoi', 'mention'] },
];

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (d?: string): string => {
    const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return d || '';
    const j = parseInt(m[3], 10);
    return `${j === 1 ? '1er' : j} ${MOIS[parseInt(m[2], 10) - 1]} ${m[1]}`;
};
const majuscule = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const libelle = (m: Meta): string =>
    `${majuscule(m.nature)}${m.numero ? ` n° ${m.numero}` : ''}${m.date ? ` du ${dateFr(m.date)}` : ''}`;

const TextesLiesJO: React.FC<{ cible: { type: 'article' | 'code'; id: string } }> = ({ cible }) => {
    const [aretes, setAretes] = useState<Arete[]>([]);

    useEffect(() => {
        let annule = false;
        setAretes([]);
        supabase.from('legal_edge').select('src_id, relation, meta')
            .eq('source', 'jo-graphe-2026-10').eq('dst_type', cible.type).eq('dst_id', cible.id).limit(500)
            .then(({ data }) => { if (!annule && data) setAretes(data as Arete[]); });
        return () => { annule = true; };
    }, [cible.type, cible.id]);

    if (!aretes.length) return null;

    // Un acte par groupe (un même acte peut avoir plusieurs relations : il apparaît dans chaque groupe concerné).
    const groupes = GROUPES.map((g) => {
        const vus = new Map<string, Meta>();
        aretes.filter((a) => g.relations.includes(a.relation)).forEach((a) => { if (!vus.has(a.src_id)) vus.set(a.src_id, a.meta || {}); });
        const items = Array.from(vus.entries()).sort((x, y) => (y[1].date || '').localeCompare(x[1].date || ''));
        return { ...g, items };
    }).filter((g) => g.items.length);
    const total = new Set(aretes.map((a) => a.src_id)).size;

    return (
        <details className="textes-lies-jo">
            <summary>
                <Network size={16} /> Textes liés au Journal officiel <span className="textes-lies-jo__nb">{total}</span>
            </summary>
            {groupes.map((g) => (
                <div key={g.titre} className="textes-lies-jo__groupe">
                    <h3>{g.titre} <span>({g.items.length})</span></h3>
                    <ul>
                        {g.items.map(([id, m]) => (
                            <li key={id}>
                                {m.slug_texte
                                    ? <Link to={urlTexte(m.slug_texte)}>{libelle(m)}</Link>
                                    : <span className="textes-lies-jo__acte">{libelle(m)}</span>}
                                {m.intitule && <span className="textes-lies-jo__intitule"> {m.intitule}</span>}
                                {m.jo_numero && (
                                    <span className="textes-lies-jo__jo"> J.O. n° {m.jo_numero}{m.jo_date ? ` du ${dateFr(m.jo_date)}` : ''}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </details>
    );
};

export default TextesLiesJO;
