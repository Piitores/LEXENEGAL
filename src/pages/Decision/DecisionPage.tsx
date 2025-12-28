import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeiliSearch } from 'meilisearch';
import { Download, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import './DecisionPage.css';

// --- CONFIG MEILISEARCH CLOUD ---
// Reuse same config (ideally move to a config/services file)
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
            // Find by slug
            const searchResponse = await index.search(slug, {
                filter: `slug = "${slug}"`,
                limit: 1
            });

            if (searchResponse.hits.length > 0) {
                setDecision(searchResponse.hits[0]);
            } else {
                console.error("Decision not found");
                // navigate('/search'); // Optional redirect
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!printRef.current || !decision) return;

        const element = printRef.current;

        try {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Lexenegal-${decision.reference}.pdf`);
        } catch (err) {
            console.error("PDF Export failed", err);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', marginTop: '4rem' }}>Chargement de la décision...</div>;
    if (!decision) return <div style={{ textAlign: 'center', marginTop: '4rem' }}>Décision introuvable.</div>;

    return (
        <div className="decisionPage">
            <button className="fabExport" onClick={handleDownloadPDF}>
                <Download size={20} />
                Télécharger PDF
            </button>

            <button
                onClick={() => navigate('/search')}
                style={{ position: 'fixed', top: '100px', left: '2rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4B5563' }}
            >
                <ArrowLeft size={20} /> Retour
            </button>

            {/* SCREEN VIEW */}
            <div className="readerContainer">
                <div className="decisionHeader">
                    <span className="decisionRef">{decision.reference}</span>
                    <h1 className="decisionTitle">{decision.chambre}</h1>
                    <div className="decisionMeta">
                        <span>{new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</span>
                        <span>{decision.matiere_principale}</span>
                    </div>
                </div>

                <div className="decisionBody">
                    {decision.texte_integral.split('\n').map((para: string, idx: number) => (
                        <p key={idx}>{para}</p>
                    ))}
                </div>
            </div>

            {/* HIDDEN PRINT TEMPLATE (Simplistic approach for html2canvas) */}
            <div className="printTemplate" ref={printRef}>
                <div className="watermark">LEXENEGAL</div>
                <div className="printHeader">
                    <img src="/logo.png" alt="Lexenegal" style={{ height: '40px' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    <div style={{ textAlign: 'right' }}>
                        <h2 style={{ margin: 0, fontSize: '14pt' }}>CERTIFIÉ CONFORME</h2>
                        <span style={{ fontSize: '10pt' }}>République du Sénégal</span>
                    </div>
                </div>

                <div style={{ padding: '20mm 0' }}>
                    <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '10mm' }}>
                        {decision.reference} - {new Date(decision.date_decision).toLocaleDateString()}
                    </h1>
                    <div style={{ fontSize: '11pt', lineHeight: '1.5', textAlign: 'justify' }}>
                        {decision.texte_integral.split('\n').map((para: string, idx: number) => (
                            <p key={idx} style={{ marginBottom: '3mm' }}>{para}</p>
                        ))}
                    </div>
                </div>

                <div className="printFooter" style={{ marginTop: '20mm', borderTop: '1px solid #000', paddingTop: '5mm', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Source: Lexenegal.sn</span>
                    <span>Document généré le {new Date().toLocaleDateString()}</span>
                    {/* Placeholder QR Code */}
                    <div style={{ width: '20mm', height: '20mm', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt' }}>QR</div>
                </div>
            </div>
        </div>
    );
};

export default DecisionPage;
