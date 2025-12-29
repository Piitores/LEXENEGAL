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
            // Create a temporary hidden container for PDF generation
            const pdfContainer = document.createElement('div');
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.left = '-9999px';
            pdfContainer.style.width = '210mm'; // A4 Width
            pdfContainer.style.backgroundColor = '#fff';
            pdfContainer.style.padding = '20mm'; // Margins
            pdfContainer.style.fontFamily = 'Georgia, serif';
            pdfContainer.style.color = '#000';

            // Add Line Numbering CSS
            const style = document.createElement('style');
            style.innerHTML = `
                .pdf-content p { position: relative; margin-bottom: 1em; text-align: justify; line-height: 1.6; }
                .pdf-content p::before {
                    content: counter(para);
                    counter-increment: para;
                    position: absolute;
                    left: -15mm;
                    color: #888;
                    font-size: 8pt;
                    font-family: sans-serif;
                    width: 10mm;
                    text-align: right;
                }
                .pdf-content { counter-reset: para; }
                .master-header { text-align: center; border-bottom: 2px double #047857; margin-bottom: 10mm; padding-bottom: 5mm; }
                .master-cartouche { display: flex; justify-content: space-between; border: 1px solid #ccc; padding: 5mm; margin-bottom: 10mm; font-size: 10pt; background: #f9f9f9; }
                .master-composition { margin-bottom: 10mm; font-size: 10pt; font-style: italic; }
                h4 { color: #047857; text-transform: uppercase; margin-top: 10mm; border-bottom: 1px solid #eee; }
            `;
            pdfContainer.appendChild(style);

            // Watermark overlay
            const watermark = document.createElement('div');
            watermark.style.position = 'fixed'; // Fixed relative to pages? jsPDF handles this differently. 
            // Better: Add watermark via jsPDF API later, OR putting it in background.
            // Let's use jsPDF API for watermark to ensure it repeats.

            // Content
            const content = document.createElement('div');
            content.className = 'pdf-content';
            content.innerHTML = decision.texte_integral || '';
            pdfContainer.appendChild(content);

            document.body.appendChild(pdfContainer);

            // PDF Init
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Render HTML
            await pdf.html(pdfContainer, {
                callback: function (doc) {
                    const totalPages = doc.internal.getNumberOfPages();

                    // Post-processing each page
                    for (let i = 1; i <= totalPages; i++) {
                        doc.setPage(i);

                        // 1. Watermark (Centered)
                        // Note: `addImage` is expensive if repeated. 
                        // Assuming 'watermark-logo.jpg' is loaded. We can use a colored text simply if image is issues.
                        // Ideally we load the image data once.

                        doc.setTextColor(200, 200, 200);
                        doc.setFontSize(50);
                        // doc.text("LEXENEGAL", 50, 150, { angle: 45 }); // Fallback Watermark
                        // If we needed the image, we'd load it before.

                        // 2. Footer Certification
                        doc.setFontSize(9);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Édition certifiée Lexenegal.sn - Page ${i}/${totalPages}`, 105, 290, { align: 'center' });

                        // 3. QR Code (Last Page Only)
                        if (i === totalPages) {
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://lexenegal.sn/decision/${slug}&color=047857`;
                            const img = new Image();
                            img.src = qrUrl;
                            // We can't await inside this sync loop easily unless we pre-load.
                            // For now, let's just add the footer text. QR code image loading in sync callback is hard.
                            // Alternative: Add QR code to HTML at the bottom and let it render naturally.
                        }
                    }

                    doc.save(`Lexenegal-Master-${decision.reference.replace(/\//g, '-')}.pdf`);
                    document.body.removeChild(pdfContainer); // Cleanup
                },
                x: 10, // Margins
                y: 10,
                width: 190, // A4 (210) - 20 (Margins)
                windowWidth: 800 // High Res Virtual Width
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
