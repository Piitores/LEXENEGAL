import React from 'react';
import './TextPresentation.css';

interface TextPresentationLaw {
    title: string;
    short_title?: string | null;
    category: string;
    reference?: string | null;
    publication_date?: string | null;
    description?: string | null;
}

interface Props {
    law: TextPresentationLaw;
    articleCount?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
    code: 'Code',
    loi: 'Loi',
    decret: 'Décret',
    arrete: 'Arrêté',
    circulaire: 'Circulaire',
    ohada: 'Acte uniforme OHADA',
    uemoa: 'Texte UEMOA',
    convention: 'Convention collective',
    jors: 'Journal officiel',
};

function formatDateFr(d?: string | null): string | null {
    if (!d) return null;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Bloc « Présentation » en tête de page d'un texte (même URL).
 * Données réelles uniquement : nature, référence, date, et `description` (HTML
 * de confiance) si présente. Se dégrade proprement (jamais de bloc vide).
 * Rendu aussi côté serveur (api/render.js) pour le SEO.
 */
const TextPresentation: React.FC<Props> = ({ law, articleCount }) => {
    const nature = CATEGORY_LABELS[law.category] || 'Texte juridique';
    const date = formatDateFr(law.publication_date);
    const hasDescription = !!(law.description && law.description.trim());

    return (
        <section className="text-presentation" aria-label="Présentation du texte">
            <div className="text-presentation__meta">
                <span className="tp-nature">{nature}</span>
                {law.reference && <span className="tp-chip">{law.reference}</span>}
                {date && <span className="tp-chip">Publié le {date}</span>}
                {typeof articleCount === 'number' && articleCount > 0 && (
                    <span className="tp-chip">{articleCount.toLocaleString('fr-FR')} articles</span>
                )}
            </div>

            {hasDescription ? (
                <>
                    <h2 className="text-presentation__label">Présentation</h2>
                    <div
                        className="text-presentation__body legal-content"
                        dangerouslySetInnerHTML={{ __html: law.description as string }}
                    />
                </>
            ) : (
                <p className="text-presentation__fallback">
                    {law.short_title || law.title} — texte intégral consolidé, à jour et structuré
                    article par article, dans le corpus du droit sénégalais sur Lexenegal.
                </p>
            )}
        </section>
    );
};

export default TextPresentation;
