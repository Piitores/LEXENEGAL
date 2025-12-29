import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft } from 'lucide-react';
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

    const handleDownloadPDF = async () => {
        if (!decision) return;

        try {
            // 1. Prepare HTML Content with EXPLICIT numbering (No CSS Counters)
            // We use a temporary DOM parser to inject numbers into paragraphs
            const parser = new DOMParser();

            // Allow for Legacy or Master Edition content
            let htmlContent = decision.texte_integral || '';
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // Find all P tags in the body
            const paragraphs = doc.querySelectorAll('.master-body p, .decisionBody p');
            let paraCount = 1;

            Array.from(paragraphs).forEach((pNode) => {
                const p = pNode as HTMLElement;
                // Ignore empty paragraphs
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
                    // Strict cast to avoid TS2339
                    if (p.style) {
                        p.style.position = 'relative';
                    } else {
                        // Fallback if style missing on element type (unlikely in DOM but possible in types)
                        (p as any).style = { position: 'relative' };
                        (p as any).style.position = 'relative';
                    }
                    p.prepend(numSpan);
                }
                paraCount++;
            });

            // 2. Setup Container for PDF (Visual Clone)
            const pdfContainer = document.createElement('div');
            // Hardcoded A4 pixel width at 96 DPI (approx 794px) to ensure consistent wrapping
            const A4_WIDTH_PX = 794;

            pdfContainer.style.width = `${A4_WIDTH_PX}px`;
            pdfContainer.style.padding = '20mm'; // Margin
            pdfContainer.style.backgroundColor = '#ffffff';
            pdfContainer.style.fontFamily = 'Georgia, serif';
            pdfContainer.style.fontSize = '12pt';
            pdfContainer.style.lineHeight = '1.6';
            pdfContainer.style.color = '#000';
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.top = '0';
            pdfContainer.style.left = '0';
            pdfContainer.style.zIndex = '-9999'; // Hide it behind everything

            // Watermark as Background Pattern
            pdfContainer.style.backgroundImage = 'url(/watermark-logo.jpg)';
            pdfContainer.style.backgroundRepeat = 'repeat-y'; // Repeat down the page? Or centered fixed?
            pdfContainer.style.backgroundPosition = 'center top';
            pdfContainer.style.backgroundSize = '50% auto'; // Large logo
            // Actually, for multiple pages, we want it repeated or fixed?
            // jsPDF rendering splits the canvas. Background image might be cut cleanly.
            // Let's try centered watermark on a wrapper per page? Hard to know page breaks.
            // Safe bet: Fixed background attachment? html2canvas supports it poorly.
            // Better: Simple centered watermark using CSS opacity.
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

            // Container for Text (Above Watermark)
            const textContainer = document.createElement('div');
            textContainer.style.position = 'relative';
            textContainer.style.zIndex = '1';
            textContainer.innerHTML = doc.body.innerHTML; // The modified HTML
            pdfContainer.appendChild(textContainer);

            // Append to body to allow rendering
            document.body.appendChild(pdfContainer);

            // 3. Generate PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Use .html with smaller scale to fit the 794px into 210mm
            // 210mm approx 794px. So scale 1 roughly.
            // However, margins in .html() occupy space.

            await pdf.html(pdfContainer, {
                callback: function (doc) {
                    const totalPages = (doc as any).internal.getNumberOfPages();

                    // Add Footer / Certification
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);
                        doc.setFontSize(9);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Édition certifiée Lexenegal.sn - Page ${i}/${totalPages}`, pdfWidth / 2, 290, { align: 'center' });

                        // Add QR Code on Last Page
                        if (i === totalPages) {
                            // Can we add image here?
                            // We load the QR image synchronously? No, images need callbacks.
                            // But we can rely on standard <img> tag inside the HTML if we wanted.
                            // Let's rely on the user manually verifying the text first. 
                            // The QR logic from before was complex and prone to async issues.
                            // Let's keep it simple: Text Verification is priority.
                        }
                    }

                    doc.save(`Lexenegal-Master-${decision.reference.replace(/\//g, '-')}.pdf`);
                    document.body.removeChild(pdfContainer);
                },
                x: 0,
                y: 0,
                html2canvas: {
                    useCORS: true, // Important for images
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

    const rawText = decision.texte_integral || decision.resume || "Texte intégral non disponible.";
    const isMasterEdition = rawText.includes("master-header") || rawText.includes("<div"); // Detection Strategy

    return (
        <div className="decisionPage">
            <button className="fabExport" onClick={handleDownloadPDF}>
                <Download size={20} />
                <span>Télécharger PDF (Officiel)</span>
            </button>

            <button
                onClick={() => navigate('/search')}
                style={{ position: 'fixed', top: '100px', left: '2rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4B5563', fontSize: '0.95rem' }}
            >
                <ArrowLeft size={18} /> Retour
            </button>

            {/* SCREEN VIEW */}
            <div className="readerContainer">
                {isMasterEdition ? (
                    /* MASTER EDITION RENDERING (Direct HTML) */
                    /* The HTML contains the header, cartouche, everything. We don't need the React Header above it. */
                    <div className="master-container" dangerouslySetInnerHTML={{ __html: rawText }} />
                ) : (
                    /* LEGACY RENDERING (Fallback) */
                    <>
                        <div className="decisionHeader">
                            <span className="decisionRef">{decision.reference}</span>
                            <h1 className="decisionTitle">{decision.chambre}</h1>
                            <div className="decisionMeta">
                                <span>{decision.date_decision && !isNaN(Date.parse(decision.date_decision)) ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</span>
                                <span>•</span>
                                <span>{decision.matiere_principale}</span>
                            </div>

                            {/* Parties (Legacy) */}
                            {decision.parties_principales && (
                                <div className="decisionParties">
                                    <strong>Entre :</strong> {decision.parties_principales}
                                </div>
                            )}

                            {/* Résumé (Legacy) */}
                            {decision.resume && (
                                <div className="decisionResume">
                                    <h3>📜 Résumé</h3>
                                    <p>{decision.resume}</p>
                                </div>
                            )}
                        </div>

                        <div className="decisionBody">
                            {/* Logic to fix broken lines */}
                            {typeof rawText === 'string'
                                ? rawText.split(/\n\s*\n/).map((para, idx) => (
                                    <p key={idx} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, ' ') }} />
                                ))
                                : <p>Texte non disponible</p>
                            }
                        </div>
                    </>
                )}
            </div>

            {/* HIDDEN PRINT TEMPLATE */}
            <div className="printTemplate" ref={printRef}>
                {/* Watermark Logo */}
                <img src="/watermark-logo.jpg" className="watermark-img" alt="" />

                {/* For PDF, if Master Edition, we just dump the HTML inside the print container + Footer 
                    But we need the footer outside the dangerous HTML.
                */}
                <div className="printContainer">
                    {isMasterEdition ? (
                        <>
                            <div dangerouslySetInnerHTML={{ __html: rawText }} />
                        </>
                    ) : (
                        <>
                            {/* Legacy Print Structure */}
                            <div className="printHeader" style={{ borderBottom: '2px solid #000', paddingBottom: '8mm', marginBottom: '10mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '22pt', fontFamily: 'Times New Roman', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                                        <span style={{ color: '#047857' }}>LEX</span>ENEGAL
                                    </h2>
                                    <div style={{ fontSize: '9pt', color: '#444', marginTop: '2mm', textTransform: 'uppercase', letterSpacing: '1px' }}>Base de Jurisprudence Certifiée</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <h3 style={{ margin: 0, fontSize: '12pt', textTransform: 'uppercase' }}>République du Sénégal</h3>
                                    <div style={{ fontSize: '10pt', fontStyle: 'italic' }}>Au nom du Peuple Sénégalais</div>
                                </div>
                            </div>

                            <div>
                                <h1 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm', fontWeight: 'bold', textDecoration: 'underline' }}>
                                    {decision.reference} du {decision.date_decision && !isNaN(Date.parse(decision.date_decision)) ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : 'Date N/D'}
                                </h1>
                                <div>
                                    {typeof rawText === 'string' && rawText.split(/\n\s*\n/).map((para: string, idx: number) => (
                                        <div key={idx} className="legal-line">
                                            <div className="line-number">{idx + 1}</div>
                                            <div className="line-content" dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, ' ') }}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Footer (Always Present) */}
                    <div style={{ marginTop: '15mm', paddingTop: '5mm', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8pt', color: '#555' }}>
                        <div>
                            <strong>Source Certifiée :</strong> www.lexenegal.sn<br />
                            Document généré électroniquement le {new Date().toLocaleDateString('fr-FR')}
                        </div>
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://lexenegal.sn/decision/${slug}&color=047857`}
                            alt="QR Verification"
                            style={{ width: '18mm', height: '18mm' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DecisionPage;
