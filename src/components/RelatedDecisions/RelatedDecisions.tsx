import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { outgoingSlugs, mergeRelated, type RelatedDecision } from '../../lib/relatedDecisions';
import '../RelatedTexts/RelatedTexts.css';

const COLS = 'id,slug,reference,juridiction,chambre,date_decision,parties_principales';

function formatDate(iso: string | null): string {
    if (!iso) return '';
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('fr-FR', { dateStyle: 'long' });
}

/**
 * Bloc « Décisions liées » en bas d'une page de décision. Lit le champ
 * `decisions_similaires` dans les deux sens (voir lib/relatedDecisions).
 * Rien à afficher => le composant ne rend rien.
 */
const RelatedDecisions: React.FC<{ slug?: string | null; similaires?: unknown }> = ({ slug, similaires }) => {
    const [items, setItems] = useState<RelatedDecision[]>([]);

    useEffect(() => {
        let cancelled = false;
        if (!slug) { setItems([]); return; }
        const sortants = outgoingSlugs(slug, similaires);
        (async () => {
            const [outRes, inRes] = await Promise.all([
                sortants.length
                    ? supabase.from('decisions').select(COLS).in('slug', sortants).eq('is_active', true)
                    : Promise.resolve({ data: [] as RelatedDecision[] }),
                supabase.from('decisions').select(COLS).contains('decisions_similaires', [slug])
                    .eq('is_active', true).limit(30),
            ]);
            const merged = mergeRelated(slug, [
                (outRes.data as RelatedDecision[]) || [],
                (inRes.data as RelatedDecision[]) || [],
            ]);
            if (!cancelled) setItems(merged);
        })();
        return () => { cancelled = true; };
    }, [slug, similaires]);

    if (!items.length) return null;

    return (
        <section className="related-texts" aria-label="Décisions liées">
            <h2 className="related-texts__label"><Link2 size={18} /> Décisions liées</h2>
            <div className="related-grid">
                {items.map((d) => {
                    const meta = [formatDate(d.date_decision), d.parties_principales].filter(Boolean).join(' - ');
                    return (
                        <Link key={d.id} to={`/decision/${d.slug}`} className="related-card">
                            <span className="related-card__badge">{d.juridiction || 'Décision'}</span>
                            <span className="related-card__title">
                                {[d.reference, d.chambre].filter(Boolean).join(' - ') || 'Décision'}
                            </span>
                            {meta && <span className="related-card__meta">{meta}</span>}
                        </Link>
                    );
                })}
            </div>
        </section>
    );
};

export default RelatedDecisions;
