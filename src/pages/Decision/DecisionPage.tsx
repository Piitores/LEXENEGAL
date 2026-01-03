import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft, Copy, Scale, BookOpen, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import LexenegalSymbol from '../../components/LexenegalSymbol/LexenegalSymbol';
import SEO from '../../components/SEO/SEO';

import './DecisionPage.css';

// --- CONFIG ---
// --- CONFIG ---
const client = new MeiliSearch({
    host: 'https://ms-9c13e7ae24b5-37398.fra.meilisearch.io',
    apiKey: 'eabe07740906b7bad2b7dcbe72ab6c010888bc827d3e7ec28b365810a5cad73a',
});
const index = client.index('decisions');

const DecisionPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [decision, setDecision] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // Ref for printable content
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!slug) return;
        fetchDecision();
    }, [slug]);

    const fetchDecision = async () => {
        setLoading(true);
        console.log("🔍 Fetching decision for slug:", slug);
        try {
            const searchResponse = await index.search('', {
                filter: `slug = "${slug}"`,
                limit: 1
            });
            if (searchResponse.hits.length > 0) {
                setDecision(searchResponse.hits[0]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyRef = () => {
        if (!decision) return;
        const refText = `${decision.juridiction || 'Juridiction'}, ${decision.chambre || ''}, ${decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : ''}, ${decision.reference}`;
        navigator.clipboard.writeText(refText);
        alert("Référence copiée : " + refText);
    };

    // Use react-to-print for reliable PDF generation via browser print
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: decision ? `Lexenegal-${decision.reference.replace(/\//g, '-')}` : 'Lexenegal-Decision',
        pageStyle: `
            @page {
                size: A4;
                margin: 15mm;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        `
    });

    // SKELETON LOADER - Prestige Loading State
    if (loading) return (
        <div className="decisionPage">
            {/* TOP LOADING BAR */}
            <div className="loading-bar-container">
                <div className="loading-bar"></div>
            </div>

            <div className="elite-grid">
                {/* Skeleton Sidebar */}
                <aside className="sidebar-left">
                    <div className="skeleton-nav">
                        <div className="skeleton-line" style={{ width: '60%', marginBottom: '2rem' }}></div>
                        <div className="skeleton-line" style={{ width: '80%' }}></div>
                        <div className="skeleton-line" style={{ width: '70%' }}></div>
                    </div>
                </aside>

                {/* Skeleton Content */}
                <main className="content-main skeleton-content">
                    <div className="skeleton-badge"></div>
                    <div className="skeleton-title"></div>
                    <div className="skeleton-subtitle"></div>

                    <div className="skeleton-box"></div>

                    <div className="skeleton-text">
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line" style={{ width: '90%' }}></div>
                        <div className="skeleton-line" style={{ width: '85%' }}></div>
                        <div className="skeleton-line" style={{ width: '95%' }}></div>
                        <div className="skeleton-line" style={{ width: '70%' }}></div>
                    </div>
                </main>

                {/* Skeleton Tools */}
                <aside className="sidebar-right">
                    <div className="skeleton-btn"></div>
                    <div className="skeleton-btn" style={{ marginTop: '1rem' }}></div>
                </aside>
            </div>
        </div>
    );

    if (!decision) return (
        <div className="decisionPage" style={{ alignItems: 'center', flexDirection: 'column', gap: '1rem', marginTop: '5rem' }}>
            <h2>Décision introuvable</h2>
            <div style={{ background: '#F3F4F6', padding: '2rem', borderRadius: '8px', textAlign: 'left', fontFamily: 'monospace' }}>
                <p><strong>Slug demandé :</strong> {slug}</p>
                <p><strong>URL API :</strong> {client.config.host}</p>
                <p><strong>Index :</strong> decisions</p>
                <p><strong>Debug Status :</strong> {loading ? 'Loading' : 'Finished'}</p>
                <button onClick={fetchDecision} style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>Réessayer</button>
            </div>
        </div>
    );

    const rawText = decision.texte_integral || "Texte intégral non disponible.";

    // Format date for SEO
    const formattedDate = decision.date_decision
        ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' })
        : '';

    return (
        <div className="decisionPage">
            {/* DYNAMIC SEO */}
            <SEO
                juridiction={decision.chambre || 'Cour Suprême'}
                reference={decision.reference}
                matiere={decision.matiere_principale}
                date={formattedDate}
                type="article"
                url={`https://lexenegal.sn/decision/${slug}`}
            />

            {/* BREADCRUMBS (Schema.org) */}
            <nav className="breadcrumbs" aria-label="Fil d'Ariane">
                <ol itemScope itemType="https://schema.org/BreadcrumbList">
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href="/"><span itemProp="name">Lexenegal</span></a>
                        <meta itemProp="position" content="1" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href="/search"><span itemProp="name">Sénégal</span></a>
                        <meta itemProp="position" content="2" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <span itemProp="name">{decision.chambre || 'Chambre'}</span>
                        <meta itemProp="position" content="3" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <span itemProp="name">{decision.reference}</span>
                        <meta itemProp="position" content="4" />
                    </li>
                </ol>
            </nav>

            <div className="elite-grid">
                {/* 1. LEFT SIDEBAR */}
                <aside className="sidebar-left">
                    <nav className="nav-sticky">
                        <button className="btn-back" onClick={() => navigate('/search')}>
                            <ArrowLeft size={16} /> Retour
                        </button>

                        <a href="#expert-block" className="jump-link">Synthèse</a>
                        <a href="#texte-integral" className="jump-link">Texte intégral</a>
                    </nav>
                </aside>

                {/* 2. CENTER: CONTENT */}
                <main className="content-main" id="content-main">
                    <div className="certification-badge">
                        <Scale size={14} /> Source Certifiée : Lexenegal.sn
                    </div>

                    <h1 className="decision-title">{decision.chambre || 'Chambre'}</h1>
                    <div className="decision-ref">{decision.reference} • {decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</div>

                    {/* EXPERT BLOCK */}
                    <div id="expert-block" className="expert-box">
                        <div className="expert-title"><BookOpen size={14} style={{ display: 'inline', marginRight: '8px' }} /> Synthèse Juridique</div>

                        <div style={{ marginBottom: '1rem' }}>
                            {decision.matiere_principale && <span className="keyword-badge">{decision.matiere_principale}</span>}
                        </div>

                        {decision.resume && (
                            <p style={{ fontStyle: 'italic', color: '#374151', lineHeight: '1.6' }}>
                                {decision.resume}
                            </p>
                        )}
                    </div>

                    {/* LEGAL TEXT CONTENT with WATERMARK */}
                    <div className="legal-content-wrapper">
                        <div className="watermark-container">
                            <LexenegalSymbol size={400} opacity={0.03} />
                        </div>
                        <div className="legal-content" id="texte-integral">
                            <div dangerouslySetInnerHTML={{ __html: rawText }} />
                        </div>
                    </div>
                </main>

                {/* 3. RIGHT SIDEBAR */}
                <aside className="sidebar-right">
                    <div className="tools-sticky">
                        <button className="btn-elite-primary" onClick={() => handlePrint()}>
                            <Printer size={18} />
                            Imprimer / PDF
                        </button>

                        <button className="btn-elite-secondary" onClick={handleCopyRef}>
                            <Copy size={16} />
                            Copier Référence
                        </button>
                    </div>
                </aside>
            </div>

            {/* ========== HIDDEN PRINT TEMPLATE (Off-screen but RENDERED) ========== */}
            <div style={{
                position: 'absolute',
                left: '-9999px',
                top: '0',
                width: '210mm'
            }}>
                <div ref={printRef} className="print-template">
                    {/* WATERMARK */}
                    <img
                        src="/watermark-logo.jpg"
                        alt=""
                        className="print-watermark"
                    />

                    {/* HEADER */}
                    <div className="print-header">
                        <div className="print-header-left">
                            <h1>LEXENEGAL</h1>
                            <span>Base de Jurisprudence Certifiée</span>
                        </div>
                        <div className="print-header-right">
                            <strong>RÉPUBLIQUE DU SÉNÉGAL</strong>
                            <em>Au nom du Peuple Sénégalais</em>
                        </div>
                    </div>

                    {/* TITLE */}
                    <div className="print-title">
                        <h2>{decision.reference} du {decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : ''}</h2>
                        <div className="print-subtitle">{decision.juridiction || ''}</div>
                        <div className="print-chambre">{decision.chambre || ''}</div>
                    </div>

                    {/* SYNTHÈSE JURIDIQUE */}
                    {(decision.matiere_principale || decision.resume) && (
                        <div className="print-synthese">
                            <div className="print-synthese-title">Synthèse Juridique</div>
                            {decision.matiere_principale && (
                                <div className="print-synthese-matiere">{decision.matiere_principale}</div>
                            )}
                            {decision.resume && (
                                <p className="print-synthese-resume">{decision.resume}</p>
                            )}
                        </div>
                    )}

                    {/* CONTENT */}
                    <div className="print-body" dangerouslySetInnerHTML={{ __html: rawText }} />

                    {/* FOOTER */}
                    <div className="print-footer">
                        <div>
                            Source Certifiée : www.lexenegal.sn<br />
                            Généré le {new Date().toLocaleDateString('fr-FR')}
                        </div>
                        <div>Édition certifiée Lexenegal.sn</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DecisionPage;
