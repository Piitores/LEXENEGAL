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
        if (!printRef.current || !decision) return;

        try {
            const element = printRef.current;

            // Wait for images to be ready (critical for Watermark/QR)
            const images = Array.from(element.getElementsByTagName('img'));
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
            }));

            // Capture with high scale and logic to handle off-screen rendering
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 210 * 3.7795, // Force A4 width in pixels approx
                windowHeight: 297 * 3.7795
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            // A4 dimensions in mm
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Lexenegal-${decision.reference.replace(/\//g, '-')}.pdf`);
        } catch (err) {
            console.error("PDF Export failed", err);
            alert("Erreur lors de la génération du PDF.");
        }
    };

    if (loading) return <div className="decisionPage" style={{ alignItems: 'center' }}>Chargement...</div>;
    if (!decision) return <div className="decisionPage" style={{ alignItems: 'center' }}>Décision introuvable.</div>;

    // Process text for paragraphs safely
    const rawText = decision.texte_integral || decision.resume || "Texte intégral non disponible.";
    const paragraphs = typeof rawText === 'string' ? rawText.split('\n').filter((p: string) => p.trim() !== '') : ["Contenu invalide."];

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
                <div className="decisionHeader">
                    <span className="decisionRef">{decision.reference}</span>
                    <h1 className="decisionTitle">{decision.chambre}</h1>
                    <div className="decisionMeta">
                        <span>{decision.date_decision && !isNaN(Date.parse(decision.date_decision)) ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</span>
                        <span>•</span>
                        <span>{decision.matiere_principale}</span>
                    </div>

                    {/* Parties (Master Edition) */}
                    {decision.parties_principales && (
                        <div className="decisionParties">
                            <strong>Entre :</strong> {decision.parties_principales}
                        </div>
                    )}

                    {/* Résumé (Master Edition) */}
                    {decision.resume && (
                        <div className="decisionResume">
                            <h3>📜 Résumé</h3>
                            <p>{decision.resume}</p>
                        </div>
                    )}
                </div>

                <div className="decisionBody">
                    {/* Logic to fix broken lines: Join all by space, then split by double newline if possible, 
                        OR just trust the LLM. Given the screenshot, we have hard breaks. 
                        Let's try to merge lines that don't end with punctuation or start with capital? 
                        Safer strategy: display as is but use CSS white-space: pre-wrap? 
                        Actually, split('\n') creates a <p> for every line, which defines the 'huge spacing' seen in screenshot.
                        Let's try to join single newlines.
                    */}
                    {typeof rawText === 'string'
                        ? rawText.split(/\n\s*\n/).map((para, idx) => (
                            <p key={idx} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, ' ') }} />
                        ))
                        : <p>Texte non disponible</p>
                    }
                </div>
            </div>

            {/* HIDDEN PRINT TEMPLATE */}
            <div className="printTemplate" ref={printRef}>
                {/* Watermark Logo */}
                <img src="/watermark-logo.jpg" className="watermark-img" alt="" />

                <div className="printContainer">
                    {/* Official Header */}
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

                    {/* Content with Line Numbers */}
                    <div>
                        <h1 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm', fontWeight: 'bold', textDecoration: 'underline' }}>
                            {decision.reference} du {decision.date_decision && !isNaN(Date.parse(decision.date_decision)) ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : 'Date N/D'}
                        </h1>

                        <div>
                            {paragraphs.map((para: string, idx: number) => (
                                <div key={idx} className="legal-line">
                                    <div className="line-number">{idx + 1}</div>
                                    <div className="line-content">{para}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
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
