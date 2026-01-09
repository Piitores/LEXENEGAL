import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article';
    // Decision-specific props
    juridiction?: string;
    reference?: string;
    matiere?: string;
    date?: string;
    resume?: string;
    motsCles?: string[];
    chambre?: string;
}

const SEO: React.FC<SEOProps> = ({
    title = 'Lexenegal | La Mémoire Juridique du Sénégal',
    description = 'La référence numérique du droit sénégalais. Jurisprudence certifiée du TGI Dakar, Cour d\'Appel, Cour Suprême. Barreau du Sénégal.',
    image = '/og-image.svg',
    url = 'https://lexenegal.sn',
    type = 'website',
    juridiction,
    reference,
    matiere,
    date,
    resume,
    motsCles,
    chambre
}) => {
    // Determine if this is a decision page
    const isDecisionPage = !!(reference && juridiction);

    // Build dynamic title for decisions
    const pageTitle = isDecisionPage
        ? `${reference} - ${chambre || juridiction} | Lexenegal`
        : title;

    // Build dynamic description for decisions (enriched with keywords)
    const pageDescription = isDecisionPage
        ? resume
            ? `${resume.substring(0, 150)}... | ${matiere || 'Jurisprudence'} - ${chambre || juridiction}, Sénégal.`
            : `${matiere || 'Décision'} du ${date || 'N/D'}. ${chambre || juridiction}. Texte intégral certifié - Jurisprudence Sénégal sur Lexenegal.`
        : description;

    // Dynamic keywords based on decision content
    const pageKeywords = isDecisionPage && motsCles && motsCles.length > 0
        ? `${motsCles.join(', ')}, Jurisprudence Sénégal, ${matiere || ''}, ${chambre || ''}, Cour Suprême, Droit sénégalais`
        : 'Jurisprudence Sénégal, TGI Dakar, Barreau du Sénégal, Cour d\'Appel, Cour Suprême, Droit sénégalais, Décisions de justice';

    // Build LegalCase schema for decisions (better than generic LegalService)
    const legalCaseSchema = isDecisionPage ? {
        "@context": "https://schema.org",
        "@type": "LegalCase",
        "name": `${reference} - ${chambre || juridiction}`,
        "about": matiere || "Jurisprudence sénégalaise",
        "abstract": resume || `Décision de justice - ${matiere || 'Droit'}`,
        "datePublished": date || undefined,
        "inLanguage": "fr",
        "jurisdiction": {
            "@type": "AdministrativeArea",
            "name": "Sénégal"
        },
        "court": {
            "@type": "GovernmentOrganization",
            "name": chambre || juridiction || "Cour Suprême du Sénégal"
        },
        "keywords": motsCles?.join(', ') || matiere,
        "isPartOf": {
            "@type": "WebSite",
            "name": "Lexenegal",
            "url": "https://lexenegal.sn"
        },
        "provider": {
            "@type": "Organization",
            "name": "Lexenegal",
            "url": "https://lexenegal.sn",
            "logo": "https://lexenegal.sn/favicon.svg"
        }
    } : null;

    // Generic LegalService schema for non-decision pages
    const legalServiceSchema = {
        "@context": "https://schema.org",
        "@type": "LegalService",
        "name": "Lexenegal",
        "description": "Base de jurisprudence sénégalaise certifiée",
        "url": "https://lexenegal.sn",
        "logo": "https://lexenegal.sn/favicon.svg",
        "areaServed": {
            "@type": "Country",
            "name": "Sénégal"
        },
        "serviceType": "Jurisprudence et Documentation Juridique",
        "provider": {
            "@type": "Organization",
            "name": "Lexenegal",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Dakar",
                "addressCountry": "SN"
            }
        }
    };

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{pageTitle}</title>
            <meta name="title" content={pageTitle} />
            <meta name="description" content={pageDescription} />
            <meta name="keywords" content={pageKeywords} />

            {/* Canonical URL - Prevent duplicate content */}
            <link rel="canonical" href={url} />

            {/* Geo Targeting */}
            <meta name="geo.region" content="SN" />
            <meta name="geo.placename" content="Dakar, Sénégal" />
            <meta name="language" content="fr" />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={isDecisionPage ? 'article' : type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={pageDescription} />
            <meta property="og:image" content={image} />
            <meta property="og:locale" content="fr_SN" />
            <meta property="og:site_name" content="Lexenegal" />

            {/* Twitter / X */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={url} />
            <meta property="twitter:title" content={pageTitle} />
            <meta property="twitter:description" content={pageDescription} />
            <meta property="twitter:image" content={image} />

            {/* Schema.org Structured Data */}
            {isDecisionPage && legalCaseSchema && (
                <script type="application/ld+json">
                    {JSON.stringify(legalCaseSchema)}
                </script>
            )}
            {!isDecisionPage && (
                <script type="application/ld+json">
                    {JSON.stringify(legalServiceSchema)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
