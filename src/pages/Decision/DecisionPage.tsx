import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Copy, Scale, BookOpen, Printer, AlertCircle, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { createClient } from '@supabase/supabase-js';
import LexenegalSymbol from '../../components/LexenegalSymbol/LexenegalSymbol';
import SEO from '../../components/SEO/SEO';
import DecisionActions from '../../components/DecisionActions/DecisionActions';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import { textToHtmlWithLinks } from '../../utils/articleLinkRenderer';
import { getDecisionHtml, isNewFormat } from '../../utils/decisionTextFormatter';
import { logViewDecision, logDownloadPdf } from '../../utils/auditLogger';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import AnnotationPanel from '../../components/AnnotationPanel/AnnotationPanel';

import './DecisionPage.css';

// --- CONFIG ---
// Supabase client for articles
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lphmualoyxetsgldccrw.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface ArticleInfo {
    id: string;
    article_number: string;
    slug: string;
    code_slug: string;
    code_name: string;
}

const DecisionPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    // Retour « intelligent » : revient là d'où l'on vient (résultats de recherche, position conservée),
    // sinon retombe sur la page de recherche.
    const goBack = (fallback: string) => {
        if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate(fallback);
        }
    };
    const [decision, setDecision] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [articles, setArticles] = useState<ArticleInfo[]>([]);
    const [userId, setUserId] = useState<string>('Anonymous');
    const [isPro, setIsPro] = useState(false);

    // State for Annotations
    const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
    const [annotations, setAnnotations] = useState<any[]>([]);

    // State for Certified Edition Toggle
    const [isCertified, setIsCertified] = useState(true);

    // State for Conversion Modal
    const [showConversionModal, setShowConversionModal] = useState(false);

    // State for Report Error Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Ref for printable content
    const printRef = useRef<HTMLDivElement>(null);

    // Fetch user session for fingerprinting and PRO status
    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id.substring(0, 8));

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_tier, role')
                    .eq('id', session.user.id)
                    .single();

                setIsPro(profile?.subscription_tier === 'pro' || profile?.role === 'admin');
            }
        };
        getUser();
    }, []);

    useEffect(() => {
        if (!slug) return;
        fetchDecision();
        fetchArticles();
    }, [slug]);

    const fetchDecision = async () => {
        setLoading(true);
        console.log("🔍 Fetching decision from Supabase for slug:", slug);
        try {
            const { data, error } = await supabase
                .from('decisions')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) {
                console.error('Supabase error:', error);
            } else if (data) {
                setDecision(data);
                // Log view for audit trail
                logViewDecision(slug || '');

                // Fetch annotations for this decision if user is logged in
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const { data: annotationsData } = await supabase
                        .from('user_annotations')
                        .select('*')
                        .eq('decision_id', data.id)
                        .eq('user_id', session.user.id);
                    if (annotationsData) {
                        setAnnotations(annotationsData);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAnnotation = async (annotation: any) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !decision) return;

        const payload = {
            user_id: session.user.id,
            decision_id: decision.id,
            section_type: annotation.section_type,
            content: annotation.content,
            updated_at: new Date().toISOString()
        };

        // Check if exists
        const existing = annotations.find(a => a.section_type === annotation.section_type);

        if (existing) {
            // Update
            const { error } = await supabase
                .from('user_annotations')
                .update(payload)
                .eq('id', existing.id);
            if (!error) {
                setAnnotations(annotations.map(a => a.id === existing.id ? { ...a, ...payload } : a));
            } else {
                throw error;
            }
        } else {
            // Insert
            const { data, error } = await supabase
                .from('user_annotations')
                .insert([payload])
                .select()
                .single();
            if (!error && data) {
                setAnnotations([...annotations, data]);
            } else {
                throw error;
            }
        }
    };

    // Fetch articles from Supabase for hyperlinking
    const fetchArticles = async () => {
        try {
            const { data, error } = await supabase
                .from('articles')
                .select(`
                    id,
                    article_number,
                    slug,
                    laws_and_codes!inner(slug, short_title)
                `)
                .order('display_order');

            if (error) {
                console.error('Error fetching articles:', error);
                return;
            }

            if (data) {
                const formattedArticles: ArticleInfo[] = data.map((art: any) => ({
                    id: art.id,
                    article_number: art.article_number,
                    slug: art.slug,
                    code_slug: art.laws_and_codes?.slug || 'code-travail',
                    code_name: art.laws_and_codes?.short_title || 'Code du Travail'
                }));
                setArticles(formattedArticles);
                console.log(`📚 Loaded ${formattedArticles.length} articles for hyperlinking`);
            }
        } catch (error) {
            console.error('Error in fetchArticles:', error);
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
                <p><strong>Base de données :</strong> Supabase</p>
                <p><strong>Debug Status :</strong> {loading ? 'Loading' : 'Finished'}</p>
                <button onClick={fetchDecision} style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>Réessayer</button>
            </div>
        </div>
    );

    // Get the HTML content - handles both old (texte_integral) and new (texte_brut) formats
    const rawText = getDecisionHtml(decision);

    // Transform article citations to clickable links
    const enrichedText = articles.length > 0
        ? textToHtmlWithLinks(rawText, articles, 'code-travail')
        : rawText;

    // Format date for SEO
    const formattedDate = decision.date_decision
        ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' })
        : '';

    return (
        <div className="decisionPage">
            {/* DYNAMIC SEO */}
            <SEO
                juridiction={decision.juridiction || 'Cour Suprême du Sénégal'}
                reference={decision.reference}
                matiere={decision.matiere_principale}
                date={formattedDate}
                type="article"
                url={`https://www.lexenegal.sn/decision/${slug}`}
                chambre={decision.chambre}
                resume={decision.resume}
                motsCles={decision.mots_cles}
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
                        <a itemProp="item" href="/search"><span itemProp="name">{decision.chambre || 'Chambre'}</span></a>
                        <meta itemProp="position" content="3" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href={`/decision/${slug}`}><span itemProp="name">{decision.reference}</span></a>
                        <meta itemProp="position" content="4" />
                    </li>
                </ol>
            </nav>

            <div className="elite-grid">
                {/* 1. LEFT SIDEBAR */}
                <aside className="sidebar-left">
                    <nav className="nav-sticky">
                        <button className="btn-back" onClick={() => goBack('/search')}>
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

                    <h1 className="decision-title">{[decision.juridiction, decision.reference, decision.chambre].filter(Boolean).join(' — ') || 'Décision'}</h1>
                    <div className="decision-ref">{decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</div>

                    {/* EXPERT BLOCK */}
                    <div id="expert-block" className="expert-box">
                        <div className="expert-title">
                            <BookOpen size={14} style={{ display: 'inline', marginRight: '8px' }} /> Synthèse Juridique
                        </div>

                        {/* Matière & Mots-clés */}
                        <div className="tags-container">
                            {decision.matiere_principale && (
                                <span className="tag-elite" style={{ background: 'var(--emerald-prestige)', color: '#FFF' }}>
                                    {decision.matiere_principale}
                                </span>
                            )}
                            {decision.mots_cles && Array.isArray(decision.mots_cles) && decision.mots_cles.map((kw: string, i: number) => (
                                <span key={i} className="tag-elite">{kw}</span>
                            ))}
                        </div>

                        {/* Résumé */}
                        {decision.resume && (
                            <p style={{ fontStyle: 'italic', color: '#374151', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                                {decision.resume}
                            </p>
                        )}

                        {/* Articles Cités */}
                        {decision.articles_loi_cites && Array.isArray(decision.articles_loi_cites) && decision.articles_loi_cites.length > 0 && (
                            <div className="laws-container">
                                <div className="laws-title">
                                    <Scale size={12} /> Références Légales
                                </div>
                                {decision.articles_loi_cites.map((art: string, i: number) => (
                                    <div key={i} className="law-citation">
                                        <span className="law-icon">§</span> {art}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* LEGAL TEXT CONTENT with WATERMARK */}
                    <div className="legal-content-wrapper">
                        <div className="watermark-container">
                            <LexenegalSymbol size={400} opacity={0.03} />
                        </div>
                        <div className="legal-content" id="texte-integral">
                            <div dangerouslySetInnerHTML={{ __html: enrichedText }} />
                        </div>
                    </div>
                </main>

                {/* 3. RIGHT SIDEBAR */}
                <aside className="sidebar-right">
                    <div className="tools-sticky">
                        {/* Decision Actions (Favorites & Folders) */}
                        {decision.id && (
                            <DecisionActions
                                decisionId={decision.id}
                                onNeedUpgrade={() => setShowConversionModal(true)}
                            />
                        )}

                        {/* Certified Toggle */}
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <input
                                type="checkbox"
                                id="cert-toggle"
                                checked={isCertified}
                                onChange={(e) => setIsCertified(e.target.checked)}
                                style={{ accentColor: '#047857', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <label htmlFor="cert-toggle" style={{ cursor: 'pointer', color: '#374151', lineHeight: '1.3' }}>
                                <strong>Édition Certifiée</strong><br />
                                <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Masquer la date</span>
                            </label>
                        </div>

                        <button className="btn-elite-primary" onClick={() => handlePrint()}>
                            <Printer size={18} />
                            Imprimer / PDF
                        </button>

                        <button className="btn-elite-secondary" onClick={handleCopyRef}>
                            <Copy size={16} />
                            Copier Référence
                        </button>

                        <button
                            className="btn-elite-secondary"
                            style={{
                                marginTop: '1rem',
                                border: '1px solid #10B981',
                                color: '#047857',
                                background: '#ECFDF5'
                            }}
                            onClick={() => {
                                if (isPro) {
                                    setIsAnnotationOpen(true);
                                } else {
                                    setShowConversionModal(true);
                                }
                            }}
                        >
                            <FileText size={16} />
                            Mes Annotations
                        </button>

                        <button
                            className="inline-report-btn"
                            style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                            onClick={() => setIsReportModalOpen(true)}
                        >
                            <AlertCircle size={16} />
                            Signaler une erreur
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
                    <div className="print-watermark-container">
                        <LexenegalSymbol size={600} opacity={0.04} />
                    </div>

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

                    {/* FINGERPRINT WATERMARK - Invisible traceability */}
                    <div className="print-fingerprint">
                        Édition Certifiée pour : {userId} - {new Date().toISOString().split('T')[0]}
                    </div>

                    {/* FOOTER */}
                    <div className="print-footer">
                        <div>
                            Source Certifiée : www.lexenegal.sn<br />
                            {!isCertified && (
                                <span>Généré le {new Date().toLocaleDateString('fr-FR')}</span>
                            )}
                        </div>
                        <div>Édition certifiée Lexenegal.sn</div>
                    </div>
                </div>
            </div>

            {/* CONVERSION MODAL */}
            <ConversionModal
                isOpen={showConversionModal}
                onClose={() => setShowConversionModal(false)}
                onRequestAccess={() => {
                    setShowConversionModal(false);
                    navigate('/solliciter-acces');
                }}
            />

            {/* ANNOTATION PANEL */}
            {decision && (
                <AnnotationPanel
                    isOpen={isAnnotationOpen}
                    onClose={() => setIsAnnotationOpen(false)}
                    decisionId={decision.id}
                    existingAnnotations={annotations}
                    onSave={handleSaveAnnotation}
                />
            )}

            {/* REPORT ERROR MODAL */}
            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="decision"
                entityId={decision?.id}
                url={window.location.href}
            />
        </div>
    );
};

export default DecisionPage;
