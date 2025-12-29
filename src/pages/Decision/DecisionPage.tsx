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
            // BACK TO BASICS: Create a Hidden Container in DOM (No Iframe)
            // This allows cleaner styles control while preserving the "Document" feel.

            const pdfContainer = document.createElement('div');
            const A4_WIDTH_PX = 794;

            pdfContainer.id = 'pdf-export-container';
            pdfContainer.style.width = `${A4_WIDTH_PX}px`;
            pdfContainer.style.padding = '20mm';
            pdfContainer.style.backgroundColor = '#ffffff'; // Force White
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.top = '-10000px';
            pdfContainer.style.left = '-10000px';
            pdfContainer.style.zIndex = '-9999';

            // Insert Stylesheet SCOPED to this container
            const styleTag = document.createElement('style');
            styleTag.innerHTML = `
                #pdf-export-container * {
                    color: #000000 !important;
                    font-family: 'Georgia', serif !important;
                    line-height: 1.6 !important;
                }
                #pdf-export-container .header {
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 2px solid #000;
                    padding-bottom: 5px;
                    margin-bottom: 30px;
                }
                #pdf-export-container .header-left h1 {
                    font-size: 24px; color: #047857 !important; margin: 0; text-transform: uppercase; font-family: 'Times New Roman', serif !important;
                }
                #pdf-export-container .header-left span {
                    font-size: 10px; color: #555 !important; text-transform: uppercase; letter-spacing: 1px;
                }
                #pdf-export-container .header-right {
                    text-align: right;
                }
                #pdf-export-container .header-right h3 {
                    font-size: 12px; margin: 0; text-transform: uppercase;
                }
                #pdf-export-container .header-right div {
                    font-style: italic; font-size: 10px;
                }
                
                #pdf-export-container .document-title {
                    text-align: center;
                    margin-bottom: 20px;
                }
                #pdf-export-container .document-title h2 {
                    font-size: 16px; color: #047857 !important; text-decoration: underline; margin-bottom: 5px;
                }
                
                #pdf-export-container .content-body {
                    font-size: 11px;
                    text-align: justify;
                }
                #pdf-export-container .line-wrapper {
                    position: relative;
                    margin-bottom: 4px;
                }
                #pdf-export-container .line-num {
                    position: absolute;
                    left: -25px;
                    width: 20px;
                    text-align: right;
                    color: #888 !important;
                    font-size: 8px;
                    user-select: none;
                }
                
                #pdf-export-container .footer {
                    margin-top: 50px;
                    border-top: 1px solid #ccc;
                    padding-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    color: #555 !important;
                }
            `;
            pdfContainer.appendChild(styleTag);

            // HEADER (Classic Look)
            const header = document.createElement('div');
            header.className = 'header';
            header.innerHTML = `
                <div class="header-left">
                    <h1>LEXENEGAL</h1>
                    <span>Base de Jurisprudence Certifiée</span>
                </div>
                <div class="header-right">
                    <h3>République du Sénégal</h3>
                    <div>Au nom du Peuple Sénégalais</div>
                </div>
            `;
            pdfContainer.appendChild(header);

            // TITLE & METADATA
            const titleSection = document.createElement('div');
            titleSection.className = 'document-title';
            titleSection.innerHTML = `
                <h2>${decision.reference} du ${decision.date_decision ? new Date(decision.date_decision).toLocaleDateString() : ''}</h2>
                <div style="font-size: 12px; font-weight: bold; margin-top: 5px;">${decision.juridiction || ''}</div>
                <div style="font-size: 12px; margin-top: 2px;">${decision.chambre || ''}</div>
            `;
            pdfContainer.appendChild(titleSection);

            // CONTENT PREPARATION (Logic: Split lines vs Paragraphs?)
            // If data is HTML p tags, we process them.
            const parser = new DOMParser();
            const doc = parser.parseFromString(decision.texte_integral || '', 'text/html');
            const paragraphs = doc.querySelectorAll('.master-body p, .decisionBody p');

            const contentBody = document.createElement('div');
            contentBody.className = 'content-body';

            let lineCounter = 1;
            Array.from(paragraphs).forEach((p) => {
                if (!p.textContent?.trim()) return;

                const lineWrapper = document.createElement('div');
                lineWrapper.className = 'line-wrapper';

                // Number logic
                const numSpan = document.createElement('span');
                numSpan.className = 'line-num';
                // Show number every 5 ? Or every 1? User implies visual guide.
                // Let's show every 5 explicitly, or dots?
                // Sample image shows 1, 2, 3, 4. Let's do ALL.
                numSpan.textContent = lineCounter.toString();

                lineWrapper.appendChild(numSpan);

                const textSpan = document.createElement('span');
                textSpan.innerHTML = p.innerHTML;
                lineWrapper.appendChild(textSpan);

                contentBody.appendChild(lineWrapper);
                lineCounter++;
            });
            pdfContainer.appendChild(contentBody);

            // FOOTER & WATERMARK LOGIC handled by PDF call or DOM?
            // DOM Footer for single page or bottom logic
            const footer = document.createElement('div');
            footer.className = 'footer';
            footer.innerHTML = `
               <div>
                   Source Certifiée : www.lexenegal.sn<br/>
                   Document généré électroniquement le ${new Date().toLocaleDateString()}
               </div>
               <div>
                   <!-- QR Placeholder or real usage -->
                   <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://lexenegal.sn/decision/${slug}&color=047857" style="width:40px;height:40px;" />
               </div>
            `;
            pdfContainer.appendChild(footer);

            document.body.appendChild(pdfContainer);

            // GENERATE
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();

            await pdf.html(pdfContainer, {
                callback: function (doc) {
                    // Watermark on Pages?
                    // We can loop pages and add watermark manually or use CSS bg on container?
                    // CSS bg on container is safer for html2canvas. 
                    // But let's add it via jsPDF for "3% opacity" precision.
                    const totalPages = (doc as any).internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);
                        doc.text(`Page ${i}/${totalPages}`, pdfWidth - 20, 290, { align: 'right' });
                        // Watermark logic via API if needed, or rely on clean white bg.
                    }

                    const safeRef = decision.reference.replace(/\//g, '-');
                    doc.save(`Lexenegal-Master-${safeRef}.pdf`);
                    document.body.removeChild(pdfContainer);
                },
                x: 0,
                y: 0,
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                },
                width: 210,
                windowWidth: 794
            });

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
