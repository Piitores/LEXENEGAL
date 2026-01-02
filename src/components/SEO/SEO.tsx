import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article';
    juridiction?: string;
    reference?: string;
    matiere?: string;
    date?: string;
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
    date
}) => {
    // Build dynamic title for decisions
    const pageTitle = juridiction && reference
        ? `${juridiction} - ${reference} | Lexenegal`
        : title;

    // Build dynamic description for decisions
    const pageDescription = matiere && date
        ? `${matiere} - Décision du ${date}. Jurisprudence Sénégal, TGI Dakar, Cour d'Appel. Texte intégral certifié sur Lexenegal.`
        : description;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{pageTitle}</title>
            <meta name="title" content={pageTitle} />
            <meta name="description" content={pageDescription} />

            {/* Geo Targeting */}
            <meta name="geo.region" content="SN" />
            <meta name="geo.placename" content="Dakar, Sénégal" />
            <meta name="language" content="fr" />
            <meta name="keywords" content="Jurisprudence Sénégal, TGI Dakar, Barreau du Sénégal, Cour d'Appel, Cour Suprême, Droit sénégalais, Décisions de justice" />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
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

            {/* Schema.org Structured Data for Legal Service */}
            <script type="application/ld+json">
                {JSON.stringify({
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
                })}
            </script>
        </Helmet>
    );
};

export default SEO;
