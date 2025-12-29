import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft, Copy, Scale, BookOpen } from 'lucide-react';
import html2pdf from 'html2pdf.js';

import './DecisionPage.css';

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

    useEffect(() => {
        if (!slug) return;
        fetchDecision();
    }, [slug]);

    const fetchDecision = async () => {
        setLoading(true);
        try {
            const searchResponse = await index.search(slug, {
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

    const handleDownloadPDF = async () => {
        if (!decision) return;

        // 1. Build complete PDF HTML document
        const pdfHTML = `
            <div id="pdf-content" style="
                width: 100%;
                padding: 20mm;
                background-color: #ffffff;
                color: #1a1a1a;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 11pt;
                line-height: 1.6;
            ">
                <!-- WATERMARK -->
                <img src="/watermark-logo.jpg" style="
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 400px;
                    opacity: 0.03;
                    z-index: 0;
                    pointer-events: none;
                " />
                
                <!-- HEADER -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #047857;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                ">
                    <div>
                        <h1 style="color: #047857; margin: 0; font-size: 22px; text-transform: uppercase; font-family: Georgia, serif;">LEXENEGAL</h1>
                        <span style="font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Base de Jurisprudence Certifiée</span>
                    </div>
                    <div style="text-align: right;">
                        <strong style="font-size: 11px; text-transform: uppercase;">République du Sénégal</strong><br/>
                        <em style="font-size: 10px; color: #555;">Au nom du Peuple Sénégalais</em>
                    </div>
                </div>

                <!-- TITLE -->
                <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #047857; text-decoration: underline; font-size: 16px; margin-bottom: 8px;">
                        ${decision.reference} du ${decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : ''}
                    </h2>
                    <div style="font-size: 12px; font-weight: bold;">${decision.juridiction || ''}</div>
                    <div style="font-size: 12px; margin-top: 3px;">${decision.chambre || ''}</div>
                </div>

                <!-- BODY CONTENT -->
                <div style="text-align: justify; position: relative; z-index: 1;">
                    ${decision.texte_integral || '<p>Contenu non disponible.</p>'}
                </div>

                <!-- FOOTER -->
                <div style="
                    margin-top: 40px;
                    border-top: 1px solid #ccc;
                    padding-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8px;
                    color: #666;
                ">
                    <div>
                        Source Certifiée : www.lexenegal.sn<br/>
                        Généré le ${new Date().toLocaleDateString('fr-FR')}
                    </div>
                    <div>
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://lexenegal.sn/decision/${slug}&color=047857" style="width: 35px; height: 35px;" />
                    </div>
                </div>
            </div>
        `;

        // 2. Create temp container
        const container = document.createElement('div');
        container.innerHTML = pdfHTML;
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        // 3. Configure html2pdf options
        const options = {
            margin: 0,
            filename: `Lexenegal-${decision.reference.replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            },
            jsPDF: {
                unit: 'mm' as const,
                format: 'a4' as const,
                orientation: 'portrait' as const
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // 4. Generate PDF
        try {
            await html2pdf().set(options as any).from(container).save();
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Erreur lors de la génération du PDF');
        } finally {
            document.body.removeChild(container);
        }
    };

    if (loading) return <div className="decisionPage" style={{ alignItems: 'center' }}>Chargement...</div>;
    if (!decision) return <div className="decisionPage" style={{ alignItems: 'center' }}>Décision introuvable.</div>;

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

                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#9CA3AF', marginBottom: '1rem' }}>
                            Sommaire
                        </div>
                        <a href="#expert-block" className="jump-link">Synthèse Expert</a>
                        <a href="#faits" className="jump-link">Faits & Procédure</a>
                        <a href="#motifs" className="jump-link">Motifs</a>
                        <a href="#dispositif" className="jump-link">Dispositif</a>
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
                        <button className="btn-elite-primary" onClick={handleDownloadPDF}>
                            <Download size={18} />
                            PDF Certifié
                        </button>

                        <button className="btn-elite-secondary" onClick={handleCopyRef}>
                            <Copy size={16} />
                            Copier Référence
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default DecisionPage;
