import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft, Copy, Scale, BookOpen, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

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

    if (loading) return <div className="decisionPage" style={{ alignItems: 'center' }}>Chargement...</div>;

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

    return (
        <div className="decisionPage">
            <div className="elite-grid">
                {/* 1. LEFT SIDEBAR */}
                <aside className="sidebar-left">
                    <nav className="nav-sticky">
                        <button onClick={() => navigate('/search')} style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>
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

                    {/* LEGAL TEXT CONTENT */}
                    <div className="legal-content">
                        <div dangerouslySetInnerHTML={{ __html: rawText }} />
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
