import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, BookOpen, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './RelatedTexts.css';

interface RelatedItem {
    id: string;
    slug: string;
    title: string;
    short_title: string | null;
    category: string;
}

const CAT_LABELS: Record<string, string> = {
    code: 'Code', loi: 'Loi', decret: 'Décret', arrete: 'Arrêté',
    circulaire: 'Circulaire', ohada: 'OHADA', uemoa: 'UEMOA', cima: 'CIMA',
    convention_collective: 'Convention', jors: 'JO',
};

function pathFor(cat: string, slug: string): string {
    return cat === 'convention_collective' ? `/convention/${slug}` : `/code/${slug}`;
}

/**
 * Bloc « Textes & codes liés » en bas d'une page de texte. Lit les arêtes
 * `lie_a` (legal_edge, bidirectionnel) et regroupe la cible en « Codes liés »
 * (category=code) vs « Textes liés » (lois, décrets, arrêtés, circulaires…).
 * Se dégrade proprement : rien à afficher => le composant ne rend rien.
 */
const RelatedTexts: React.FC<{ codeId?: string | null }> = ({ codeId }) => {
    const [items, setItems] = useState<RelatedItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        if (!codeId) { setItems([]); return; }
        (async () => {
            const { data: edges } = await supabase
                .from('legal_edge')
                .select('src_id,dst_id')
                .eq('relation', 'lie_a')
                .or(`src_id.eq.${codeId},dst_id.eq.${codeId}`);
            const others = Array.from(new Set((edges || [])
                .flatMap((e: any) => [e.src_id, e.dst_id])
                .filter((id: string) => id && id !== codeId)));
            if (!others.length) { if (!cancelled) setItems([]); return; }
            const { data: laws } = await supabase
                .from('laws_and_codes')
                .select('id,slug,title,short_title,category')
                .in('id', others)
                .eq('is_active', true);
            if (!cancelled) setItems((laws as RelatedItem[]) || []);
        })();
        return () => { cancelled = true; };
    }, [codeId]);

    if (!items.length) return null;

    const codes = items.filter((i) => i.category === 'code');
    const textes = items.filter((i) => i.category !== 'code');

    const card = (i: RelatedItem) => (
        <Link key={i.id} to={pathFor(i.category, i.slug)} className="related-card">
            <span className="related-card__badge">{CAT_LABELS[i.category] || 'Texte'}</span>
            <span className="related-card__title">{i.short_title || i.title}</span>
        </Link>
    );

    return (
        <section className="related-texts" aria-label="Textes et codes liés">
            <h2 className="related-texts__label"><Link2 size={18} /> Textes &amp; codes liés</h2>
            {codes.length > 0 && (
                <div className="related-group">
                    <h3 className="related-group__title"><BookOpen size={15} /> Codes liés</h3>
                    <div className="related-grid">{codes.map(card)}</div>
                </div>
            )}
            {textes.length > 0 && (
                <div className="related-group">
                    <h3 className="related-group__title"><FileText size={15} /> Textes liés</h3>
                    <div className="related-grid">{textes.map(card)}</div>
                </div>
            )}
        </section>
    );
};

export default RelatedTexts;
