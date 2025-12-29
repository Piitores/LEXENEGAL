import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft, Copy, Scale, BookOpen, Gavel, FileText } from 'lucide-react';
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

    const printRef = useRef<HTMLDivElement>(null);

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
            // 1. Prepare HTML Content with EXPLICIT numbering (No CSS Counters)
            const parser = new DOMParser();
            let htmlContent = decision.texte_integral || '';
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Find all P tags in the body
            const paragraphs = doc.querySelectorAll('.master-body p, .decisionBody p');
            let paraCount = 1;

            Array.from(paragraphs).forEach((pNode) => {
                const p = pNode as HTMLElement;
                if (p.textContent?.trim().length === 0) return;

                const numSpan = doc.createElement('span');
                numSpan.style.position = 'absolute';
                numSpan.style.left = '-15mm';
                numSpan.style.width = '12mm';
                numSpan.style.textAlign = 'right';
                numSpan.style.color = '#9aa1a7';
                numSpan.style.fontSize = '8pt';
                numSpan.style.fontWeight = 'normal';
                numSpan.style.userSelect = 'none';
                numSpan.textContent = (paraCount * 5).toString();

                if (paraCount % 5 === 0) {
                    numSpan.textContent = paraCount.toString();
                    if (p.style) {
                        p.style.position = 'relative';
                    } else {
                        (p as any).style = { position: 'relative' };
                        (p as any).style.position = 'relative';
                    }
                    p.prepend(numSpan);
                }
                paraCount++;
            });

            // 2. Setup Container for PDF
            const pdfContainer = document.createElement('div');
            const A4_WIDTH_PX = 794;

            pdfContainer.style.width = `${A4_WIDTH_PX}px`;
            pdfContainer.style.padding = '20mm';
            pdfContainer.style.backgroundColor = '#ffffff';
            pdfContainer.style.fontFamily = 'Georgia, serif';
            pdfContainer.style.fontSize = '12pt';
            pdfContainer.style.lineHeight = '1.6';
            pdfContainer.style.color = '#000';
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.top = '0';
            pdfContainer.style.left = '0';
            pdfContainer.style.zIndex = '-9999';

            // Watermark
            const watermarkOverlay = document.createElement('div');
            watermarkOverlay.style.position = 'absolute';
            watermarkOverlay.style.top = '0';
            watermarkOverlay.style.left = '0';
            watermarkOverlay.style.width = '100%';
            watermarkOverlay.style.height = '100%';
            watermarkOverlay.style.backgroundImage = 'url(/watermark-logo.jpg)';
            watermarkOverlay.style.backgroundRepeat = 'repeat';
            watermarkOverlay.style.backgroundSize = '300px';
            watermarkOverlay.style.opacity = '0.05';
            watermarkOverlay.style.pointerEvents = 'none';
            watermarkOverlay.style.zIndex = '0';
            pdfContainer.appendChild(watermarkOverlay);

            // Container for Text
            const textContainer = document.createElement('div');
            textContainer.style.position = 'relative';
            textContainer.style.zIndex = '1';
            textContainer.innerHTML = doc.body.innerHTML;
            pdfContainer.appendChild(textContainer);

            document.body.appendChild(pdfContainer);

            // 3. Generate PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();

            await pdf.html(pdfContainer, {
                callback: function (doc) {
                    const totalPages = (doc as any).internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);
                        doc.setFontSize(9);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Édition certifiée Lexenegal.sn - Page ${i}/${totalPages}`, pdfWidth / 2, 290, { align: 'center' });
                    }
                    doc.save(`Lexenegal-Master-${decision.reference.replace(/\//g, '-')}.pdf`);
                    document.body.removeChild(pdfContainer);
                },
                x: 0,
                y: 0,
                html2canvas: {
                    useCORS: true,
                    logging: false
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
                        <a href="#content-main" className="jump-link">Lecture Intégrale</a>
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

                    {/* COMPOSITION (If not in HTML, we show placeholder or extracted data) */}
                    {/* Note: In Master Edition HTML, composition is usually embedded. We kept .master-composition styles for it. */}

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
