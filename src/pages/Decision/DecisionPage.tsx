import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft, Copy, Scale, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

        try {
            // 1. Create an invisible Iframe to ISOLATE the PDF rendering from the app's CSS (Dark Mode, etc.)
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.top = '-10000px';
            iframe.style.left = '-10000px';
            iframe.style.width = '794px'; // A4 width at 96 DPI
            iframe.style.height = '1200px'; // Initial height, will expand
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            // 2. Construct the CLEAN HTML for the iframe
            // We duplicate the logic for numbering but inject it into a clean string.

            // Numbering Logic on a temporary DOM to get the HTML string
            const parser = new DOMParser();
            let htmlContent = decision.texte_integral || '';
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const paragraphs = doc.querySelectorAll('.master-body p, .decisionBody p');
            let paraCount = 1;
            Array.from(paragraphs).forEach((pNode) => {
                const p = pNode as HTMLElement;
                if (p.textContent?.trim().length === 0) return;
                const numSpan = doc.createElement('span');
                numSpan.className = 'line-number';
                numSpan.innerHTML = (paraCount % 5 === 0) ? paraCount.toString() : (paraCount * 5).toString();
                // Logic change: user wanted every 5. Let's stick to simple "every 5 shows number, others shows nothing or dot?"
                // User said: "Numérotation des lignes : Obligatoire sur la marge gauche". Usually means line numbers 5, 10, 15...
                // Previous code did (paraCount * 5) which was wrong logic.
                // Let's print EVERY ONE for now lightly, or every 5 boldly.
                // Actually user said: "Intègre la numérotation des lignes (tous les 5 numéros)".
                if (paraCount % 5 === 0) {
                    numSpan.textContent = paraCount.toString();
                    numSpan.style.color = '#999';
                } else {
                    numSpan.textContent = ''; // Hide others
                }

                // Style for the span
                numSpan.style.position = 'absolute';
                numSpan.style.left = '-35px';
                numSpan.style.width = '30px';
                numSpan.style.textAlign = 'right';
                numSpan.style.fontSize = '10px';
                numSpan.style.userSelect = 'none';

                p.style.position = 'relative';
                p.prepend(numSpan);
                paraCount++;
            });

            const processedBodyContent = doc.body.innerHTML;

            const docContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Georgia&display=swap');
                        
                        body {
                            background-color: #FFFFFF !important;
                            color: #000000 !important;
                            font-family: 'Georgia', 'Times New Roman', serif;
                            font-size: 12pt;
                            line-height: 1.6;
                            margin: 0;
                            padding: 20mm; /* A4 Margins */
                            -webkit-print-color-adjust: exact;
                        }
                        
                        /* HEADER */
                        .master-header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #047857; padding-bottom: 10px; }
                        .master-header h2 { font-family: 'Playfair Display', serif; font-size: 20pt; color: #000; margin: 0; text-transform: uppercase; letter-spacing: 2px; }
                        .master-header .sub { font-style: italic; color: #444; margin-top: 5px; }
                        
                        /* CARTOUCHE */
                        .master-cartouche {
                            background: #FAFAF9;
                            border: 1px solid #CCC;
                            padding: 15px;
                            margin-bottom: 30px;
                            text-align: center;
                            font-family: 'Helvetica', sans-serif;
                            font-size: 10pt;
                        }
                        .master-cartouche strong { display: block; color: #047857; text-transform: uppercase; margin-bottom: 5px; }
                        
                        /* BODY */
                        .master-body { text-align: justify; }
                        .master-body h4 { color: #047857; text-align: center; margin-top: 30px; font-size: 14pt; border-bottom: 1px solid #EEE; padding-bottom: 5px; font-family: 'Playfair Display', serif; }
                        p { margin-bottom: 15px; position: relative; }
                        
                        /* WATERMARK */
                        .watermark {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 400px;
                            opacity: 0.03;
                            z-index: -1;
                        }

                        /* FOOTER */
                        .footer {
                            position: fixed;
                            bottom: 10mm;
                            width: 100%;
                            text-align: center;
                            font-size: 9pt;
                            color: #888;
                            border-top: 1px solid #EEE;
                            padding-top: 5px;
                        }
                    </style>
                </head>
                <body>
                    <img src="/watermark-logo.jpg" class="watermark" />
                    
                    <!-- HEADER INJECTION -->
                    <div class="master-header">
                        <h2>République du Sénégal</h2>
                        <div class="sub">Au nom du Peuple Sénégalais</div>
                    </div>
                    
                    <!-- CARTOUCHE INJECTION -->
                     <div class="master-cartouche">
                        <strong>${decision.juridiction || 'Tribunal de Grande Instance'}</strong>
                        <div style="font-weight:bold; margin: 5px 0;">${decision.chambre || '2ème Chambre Correctionnelle'}</div>
                        <div>${decision.reference} du ${decision.date_decision ? new Date(decision.date_decision).toLocaleDateString() : ''}</div>
                    </div>

                    <!-- CONTENT -->
                    <div class="master-body">
                        ${processedBodyContent}
                    </div>

                    <!-- FOOTER (Will be repeated by JS usually, but for Image capture checking plain footer) -->
                    <div class="footer">
                        Édition certifiée Lexenegal.sn
                    </div>
                </body>
                </html>
            `;

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(docContent);
                iframeDoc.close();
            }

            // 3. Wait for content to render (Images, Fonts)
            iframe.onload = async () => {
                try {
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();

                    // We capture the BODY of the iframe
                    // Note: html2canvas inside iframe might need window context
                    // But we can pass the body element.

                    const elementToCapture = iframeDoc?.body;

                    if (elementToCapture) {
                        // Force dimensions for capture to mimic A4
                        // A4 is 210mm wide. At 96dpi approx 794px.
                        // High res capture: scale 2 or 3.

                        await pdf.html(elementToCapture as HTMLElement, {
                            callback: (doc) => {
                                // Cleanup
                                document.body.removeChild(iframe);
                                // Safe replacement for slashes
                                const safeRef = decision.reference.replace(/\//g, '-');
                                doc.save(`Lexenegal-Master-${safeRef}.pdf`);
                            },
                            x: 0,
                            y: 0,
                            html2canvas: {
                                scale: 2,
                                useCORS: true,
                                backgroundColor: '#ffffff', // FORCE WHITE AGAIN
                                windowWidth: 794
                            },
                            width: 210,
                            windowWidth: 794
                        });
                    }
                } catch (e) {
                    console.error("Capture failed", e);
                    alert("Erreur PDF");
                }
            };

            // Fallback trigger if onload hangs
            // setTimeout(() => { if (document.body.contains(iframe)) iframe.onload?.(new Event('load')); }, 1000);

        } catch (err) {
            console.error("PDF Export failed", err);
            alert("Erreur lors de la génération du PDF.");
        }
    };

    if (loading) return <div className="decisionPage" style={{ alignItems: 'center' }}>Chargement...</div>;
    if (!decision) return <div className="decisionPage" style={{ alignItems: 'center' }}>Décision introuvable.</div>;

    const rawText = decision.texte_integral || "Texte intégral non disponible.";

    return (
        <div className="decisionPage">
            <div className="elite-grid">
                {/* 1. LEFT SIDEBAR: NAVIGATION */}
                <aside className="sidebar-left">
                    <nav className="nav-sticky">
                        <button onClick={() => navigate('/search')} style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>
                            <ArrowLeft size={16} /> Retour
                        </button>

                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#9CA3AF', marginBottom: '1rem' }}>
                            Sommaire
                        </div>
                        <a href="#expert-block" className="jump-link">Synthèse Expert</a>
                        <a href="#composition-block" className="jump-link">Composition</a>
                        {/* New Semantic Links based on Ingest IDs */}
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

                    <h1 className="decision-title">{decision.chambre || 'Chambre Inconnue'}</h1>
                    <div className="decision-ref">{decision.reference} • {decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</div>

                    {/* EXPERT BLOCK */}
                    <div id="expert-block" className="expert-box">
                        <div className="expert-title"><BookOpen size={14} style={{ display: 'inline', marginRight: '8px' }} /> Synthèse Juridique</div>

                        <div style={{ marginBottom: '1rem' }}>
                            {decision.matiere_principale && <span className="keyword-badge">{decision.matiere_principale}</span>}
                            {decision.sections_inferred && decision.sections_inferred.map((sec: string) => (
                                <span className="keyword-badge" key={sec}>{sec}</span>
                            ))}
                        </div>

                        {decision.resume && (
                            <p style={{ fontStyle: 'italic', color: '#374151', lineHeight: '1.6' }}>
                                {decision.resume}
                            </p>
                        )}
                    </div>

                    {/* LEGAL TEXT CONTENT */}
                    <div className="legal-content">
                        {/* We use dangerouslySetInnerHTML to render the Master Edition HTML structure */}
                        <div dangerouslySetInnerHTML={{ __html: rawText }} />
                    </div>
                </main>

                {/* 3. RIGHT SIDEBAR: TOOLS */}
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
