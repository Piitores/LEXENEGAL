import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Copy, Scale, BookOpen, Printer, AlertCircle, FileText, Home, Search } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../lib/supabase';
import { avecReprise } from '../../lib/reprise';
import useAuth from '../../hooks/useAuth';
import ChargementInterrompu from '../../components/ChargementInterrompu/ChargementInterrompu';
import LexenegalSymbol from '../../components/LexenegalSymbol/LexenegalSymbol';
import SEO from '../../components/SEO/SEO';
import DecisionActions from '../../components/DecisionActions/DecisionActions';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import { findAllArticleCitations, textToHtmlWithLinks } from '../../utils/articleLinkRenderer';
import { urlArticle } from '../../lib/urls';
import { chargerArticlesDesCodes, chargerConcordanceDesCodes } from '../../lib/articlesDuCode';
import ArticleHoverPreview from '../../components/ArticleHoverPreview/ArticleHoverPreview';
import {
    buildCodeIndex, buildSuccessions, codePourDecision, parseCitedString, normalizeToken,
    construireIndexRenvoi, resoudreRenvoi,
    type ResolvedArticle, type Succession, type LigneConcordance,
} from '../../lib/articleRefResolver';
import { CODES_REFONDUS, TEXTES_FUSIONNES, textesRetires } from '../../lib/routeTexte';
import { requeteVersion } from '../../lib/versionsArticle';
import { getDecisionHtml } from '../../utils/decisionTextFormatter';

/** Colonnes lues par la page (et le PDF). ⛔ Jamais texte_brut ni '*' : cf. getDecisionHtml. */
export const COLONNES_DECISION = 'id, slug, reference, juridiction, chambre, date_decision, matiere_principale, resume, mots_cles, articles_loi_cites, decisions_similaires, texte_integral';
import { logViewDecision, logDownloadPdf } from '../../utils/auditLogger';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import AnnotationPanel from '../../components/AnnotationPanel/AnnotationPanel';
import ActionButton from '../../components/ui/ActionButton';
import RelatedDecisions from '../../components/RelatedDecisions/RelatedDecisions';

import './DecisionPage.css';
import '../Error/NotFoundPage.css';

// --- CONFIG ---

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
    // Échec technique persistant (erreur ou délai maximal dépassé, cf. lib/delaiRequetes.ts) :
    // « Chargement interrompu » + « Réessayer », JAMAIS « Décision introuvable » (Soft 404).
    const [echec, setEchec] = useState(false);
    // « Réessayer » incrémente ce compteur : l'effet de chargement repart, sans recharger la page.
    const [tentative, setTentative] = useState(0);
    // Numéro du chargement en cours : une réponse d'un chargement dépassé n'écrit rien.
    const chargementCourant = useRef(0);
    const [articles, setArticles] = useState<ArticleInfo[]>([]);
    // Concordance des codes refondus cités dans le corps (fusion des codes 2026) : [] = aucune.
    const [concordances, setConcordances] = useState<Record<string, LigneConcordance[] | null>>({});
    const [codeIndex, setCodeIndex] = useState<Map<string, string>>(new Map());
    // Texte en vigueur → texte qu'il a abrogé (ex. décret 2021-1469 → arrêté général n° 5254 de
    // 1954), pour dater les renvois. Les codes refondus en 2026 passent par leur concordance.
    const [successions, setSuccessions] = useState<Map<string, Succession>>(new Map());
    // Textes retirés par la fusion des codes 2026 (code-travail-2026…), absents de la base.
    const [retires, setRetires] = useState<ReadonlySet<string>>(new Set());
    // Références citées résolues en liens fiables (raw → article présent en base, et paramètres
    // de version de son adresse : ?ancien=L56&date=<date de la décision>).
    const [citedResolved, setCitedResolved] = useState<Record<string, ResolvedArticle & { date?: string; ancien?: string }>>({});
    // Auth : favoris/annotations/PDF ouverts à tout compte connecté (Pro reporté).
    const { isConnected } = useAuth();

    // State for Annotations
    const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
    const [annotations, setAnnotations] = useState<any[]>([]);

    // Génération PDF en cours (anti double-clic)
    const [pdfBusy, setPdfBusy] = useState(false);

    // State for Conversion Modal
    const [showConversionModal, setShowConversionModal] = useState(false);

    // State for Report Error Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Ref for printable content
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!slug) return;
        fetchDecision();
        fetchCodesIndex();
    }, [slug, tentative]);

    // Liens du corps de l'arrêt : on ne charge que les articles des codes RÉELLEMENT cités
    // dans le texte (motifs de CODE_CONFIG), en lecture paginée. Avant, la page chargeait
    // tous les articles de la base d'une traite : tronqués en silence à 1 000 lignes, la
    // plupart des codes n'y figuraient pas et leurs renvois restaient du texte brut.
    // Fusion des codes 2026 : la concordance des codes cités est lue avec (jamais d'exception ;
    // illisible, un code refondu reste sans lien plutôt qu'avec un lien faux).
    useEffect(() => {
        setArticles([]);
        setConcordances({});
        if (!decision) return;
        const codeSlugs = Array.from(new Set(findAllArticleCitations(getDecisionHtml(decision)).map((c) => c.codeSlug)));
        if (!codeSlugs.length) return;
        let active = true;
        Promise.all([chargerArticlesDesCodes(codeSlugs), chargerConcordanceDesCodes(codeSlugs)])
            .then(([arts, conc]) => {
                if (!active) return;
                setConcordances(conc);
                setArticles(arts);
                console.log(`📚 Loaded ${arts.length} articles for hyperlinking (${codeSlugs.join(', ')})`);
            })
            .catch((error) => console.error('Error fetching articles:', error));
        return () => { active = false; };
    }, [decision]);

    // Résout les références citées en liens FIABLES via une requête CIBLÉE (uniquement les
    // codes réellement cités) : pas de plafond 1000, pas de lien mort. Conservateur.
    useEffect(() => {
        const cites: string[] = Array.isArray(decision?.articles_loi_cites) ? decision.articles_loi_cites : [];
        if (!cites.length || codeIndex.size === 0) return;
        let active = true;
        (async () => {
            const dateDecision: string | null = decision?.date_decision ?? null;
            const reperes: { raw: string; code: string; articleNumber: string }[] = [];
            for (const raw of cites) {
                const refs = parseCitedString(raw);
                if (refs.length !== 1) continue; // multi-réfs / aucune → texte (sécurité)
                let trouve = codeIndex.get(normalizeToken(refs[0].codeToken));
                if (!trouve) continue; // code hors corpus → texte
                // Sigle encore rattaché à un texte retiré par la fusion des codes 2026 (ref_code non
                // fusionné) : le texte qui l'a absorbé.
                if (retires.has(trouve)) trouve = TEXTES_FUSIONNES[trouve] ?? trouve;
                reperes.push({ raw, code: trouve, articleNumber: refs[0].articleNumber });
            }
            if (!reperes.length) return;
            const concordances = await chargerConcordanceDesCodes(reperes.map((r) => r.code));
            if (!active) return;

            const candidates: { raw: string; codeSlug: string; repli?: string; articleNumber: string }[] = [];
            for (const r of reperes) {
                const conc = concordances[r.code];
                if (conc && conc.length) {
                    // Code refondu (fusion des codes 2026) : un seul texte, deux numérotations ; la
                    // date de la décision choisit la bonne (resoudreRenvoi), par la concordance.
                    candidates.push({ raw: r.raw, codeSlug: r.code, articleNumber: r.articleNumber });
                } else if (conc === null && CODES_REFONDUS.has(r.code)) {
                    continue; // concordance illisible : pas de lien plutôt qu'un lien faux
                } else {
                    // Texte remplacé par un AUTRE texte : le code visé dépend de la DATE de la
                    // décision (une décision de 2015 vise l'arrêté de 1954, pas le décret de 2021 ;
                    // arbitrage du 27/09/2026).
                    const { code, repli } = codePourDecision(r.code, dateDecision, successions);
                    candidates.push({ raw: r.raw, codeSlug: code, repli, articleNumber: r.articleNumber });
                }
            }
            if (!candidates.length) return;
            const codeSlugs = Array.from(new Set(candidates.flatMap((c) => (c.repli ? [c.codeSlug, c.repli] : [c.codeSlug]))));
            // Lecture PAGINÉE et ordonnée (chargerArticlesDesCodes) : PostgREST plafonne en silence à
            // 1 000 lignes, et deux codes cités (ex. Code du travail + COCC) les dépassent. Ordre de
            // lecture (display_order, puis id) : à numéro égal, le premier l'emporte, soit le corps du
            // code avant ses annexes (« Article 5 du Code pénal » ≠ article 5 de l'annexe III).
            let arts: ResolvedArticle[] = [];
            try {
                arts = await chargerArticlesDesCodes(codeSlugs);
            } catch (error) {
                console.error('Error fetching cited articles:', error);
            }
            if (!active) return;
            const byCode = new Map<string, ResolvedArticle[]>();
            for (const a of arts) byCode.set(a.code_slug, [...(byCode.get(a.code_slug) || []), a]);
            const index = new Map(codeSlugs.map((cs) => [cs, construireIndexRenvoi(byCode.get(cs) || [], concordances[cs] ?? [], cs)]));
            const resolved: Record<string, ResolvedArticle & { date?: string; ancien?: string }> = {};
            for (const c of candidates) {
                const ref = { numero: c.articleNumber, date: dateDecision };
                const r = resoudreRenvoi(ref, index.get(c.codeSlug)) || (c.repli ? resoudreRenvoi(ref, index.get(c.repli)) : null);
                if (r) resolved[c.raw] = { ...r.article, ...r.query };
            }
            if (active) setCitedResolved(resolved);
        })();
        return () => { active = false; };
    }, [decision, codeIndex, successions, retires]);

    const fetchDecision = async () => {
        const numero = ++chargementCourant.current;
        const depasse = () => numero !== chargementCourant.current;
        setLoading(true);
        setEchec(false);
        console.log("🔍 Fetching decision from Supabase for slug:", slug);
        try {
            // maybeSingle et non single : « aucune ligne » est une ABSENCE (data null, sans erreur) ;
            // toute erreur est technique (« Chargement interrompu »), jamais « introuvable ».
            // Colonnes EXPLICITES (07/10/2026) : le rôle public n'a plus le droit de lire texte_brut
            // (non pseudonymisé), un select('*') échouerait pour toutes les décisions (42501).
            const { data, error } = await avecReprise(() => supabase
                .from('decisions')
                .select(COLONNES_DECISION)
                .eq('slug', slug)
                .maybeSingle());
            if (depasse()) return;

            if (error) {
                console.error('Supabase error:', error);
                setEchec(true);
            } else {
                // Vraie absence : « Décision introuvable » (et non la décision consultée précédemment).
                setDecision(data ?? null);
            }
            if (data) {
                // Log view for audit trail
                logViewDecision(slug || '');

                // Annotations de l'utilisateur connecté : secondaires, un échec ne prive pas du texte.
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const { data: annotationsData } = await supabase
                            .from('user_annotations')
                            .select('*')
                            .eq('decision_id', data.id)
                            .eq('user_id', session.user.id);
                        if (annotationsData && !depasse()) {
                            setAnnotations(annotationsData);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching annotations:', error);
                }
            }
        } catch (error) {
            console.error(error);
            if (!depasse()) setEchec(true);
        } finally {
            if (!depasse()) setLoading(false);
        }
    };

    const reessayer = () => setTentative((t) => t + 1);

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

    // Index des textes et de leurs alias, pour résoudre les références citées en liens fiables
    // (les articles du corps de l'arrêt sont chargés à part, cf. l'effet sur `decision`).
    const fetchCodesIndex = async () => {
        try {
            // Index générique des codes (extensible) pour résoudre les références citées en liens fiables.
            // Alias d'acronymes = vue DB `code_aliases` (source unique, dérivée de ref_code).
            const [{ data: laws }, { data: aliases }] = await Promise.all([
                supabase.from('laws_and_codes').select('slug, title, short_title, abrogated_by_slug, publication_date').eq('is_active', true),
                supabase.from('code_aliases').select('code_slug, alias'),
            ]);
            // Sans la liste des textes (et donc des successions), mieux vaut aucun lien qu'un lien
            // faux : un texte remplacé (arrêté de 1954 → décret de 2021) serait daté au hasard. Les
            // codes refondus en 2026 (même numérotation nue pour les deux CSS) sont datés par leur
            // concordance, cf. resoudreRenvoi.
            if (laws) {
                setRetires(textesRetires(laws.map((l: any) => l.slug)));
                setSuccessions(buildSuccessions(laws));
                setCodeIndex(buildCodeIndex(laws, (aliases || []).map((a: any) => ({ alias: a.alias, code_slug: a.code_slug }))));
            }
        } catch (error) {
            console.error('Error in fetchCodesIndex:', error);
        }
    };

    const handleCopyRef = () => {
        if (!decision) return;
        const refText = [
            decision.juridiction,
            decision.chambre,
            decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR') : null,
            decision.reference
        ].filter(Boolean).join(', ');
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

    // Téléchargement du PDF premium (rendu @react-pdf, sans passer par l'impression).
    const handleDownloadPdf = async () => {
        if (!isConnected) { setShowConversionModal(true); return; }
        if (!decision || pdfBusy) return;
        setPdfBusy(true);
        try {
            // Chargé à la demande : @react-pdf/renderer reste hors du bundle principal.
            const { downloadDecisionPdf } = await import('../../pdf/downloadDecisionPdf');
            await downloadDecisionPdf(decision, getDecisionHtml(decision));
            if (slug) logDownloadPdf(slug);
        } catch (e) {
            console.error('PDF generation failed:', e);
            alert("Le téléchargement du PDF a échoué. Vous pouvez utiliser le bouton Imprimer en attendant.");
        } finally {
            setPdfBusy(false);
        }
    };

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

    if (echec) return (
        <div className="decisionPage">
            <ChargementInterrompu pleineHauteur onReessayer={reessayer} />
        </div>
    );

    if (!decision) return (
        <div className="not-found-container">
            <div className="not-found-content">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                    <Scale size={56} strokeWidth={1.25} color="#047857" aria-hidden="true" />
                </div>
                <h1 className="not-found-title">Décision introuvable</h1>
                <p className="not-found-message">
                    Cette décision n'est pas (ou plus) disponible sur Lexenegal. Le lien est
                    peut-être ancien, ou la décision a été retirée du périmètre de publication.
                </p>
                <div className="not-found-actions">
                    <button className="nf-btn-primary" onClick={() => navigate('/search')}>
                        <Search size={18} />
                        Rechercher une décision
                    </button>
                    <button className="nf-btn-secondary" onClick={() => navigate('/')}>
                        <Home size={18} />
                        Retour à l'accueil
                    </button>
                </div>
                <div className="not-found-report">
                    <button className="nf-report-link" onClick={() => setIsReportModalOpen(true)}>
                        <AlertCircle size={16} />
                        Signaler ce lien cassé
                    </button>
                </div>
            </div>
            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="decision"
                url={window.location.href}
            />
        </div>
    );

    // Contenu HTML tiré de texte_integral (jamais texte_brut, cf. getDecisionHtml)
    const rawText = getDecisionHtml(decision);

    // Transform article citations to clickable links. La date de la décision choisit, pour un
    // code refondu en 2026, l'ancienne ou la nouvelle numérotation, et date l'adresse du renvoi.
    const enrichedText = articles.length > 0
        ? textToHtmlWithLinks(rawText, articles, { dateCitation: decision.date_decision, concordances })
        : rawText;

    // Format date for SEO
    const formattedDate = decision.date_decision
        ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' })
        : '';

    // Boutons d'action (favoris, PDF, impression…) - rendus deux fois : colonne
    // droite (desktop) et barre sous le titre (<1200px, où la colonne est masquée)
    const decisionTools = (
        <>
            {/* Decision Actions (Favorites & Folders) */}
            {decision.id && (
                <DecisionActions
                    decisionId={decision.id}
                    onNeedUpgrade={() => setShowConversionModal(true)}
                />
            )}

            {/* Export PDF/impression réservés au compte connecté (levier d'acquisition ; lecture libre). */}
            <ActionButton
                variant="primary"
                icon={<Download size={18} />}
                onClick={handleDownloadPdf}
                disabled={pdfBusy}
                aria-busy={pdfBusy}
            >
                {pdfBusy ? 'Génération…' : 'Télécharger le PDF'}
            </ActionButton>

            <ActionButton
                variant="secondary"
                icon={<Printer size={16} />}
                onClick={() => { if (isConnected) { handlePrint(); } else { setShowConversionModal(true); } }}
            >
                Imprimer
            </ActionButton>

            <ActionButton variant="secondary" icon={<Copy size={16} />} onClick={handleCopyRef}>
                Copier Référence
            </ActionButton>

            <ActionButton
                variant="secondary"
                icon={<FileText size={16} />}
                onClick={() => {
                    if (isConnected) {
                        setIsAnnotationOpen(true);
                    } else {
                        setShowConversionModal(true);
                    }
                }}
            >
                Mes Annotations
            </ActionButton>

            <ActionButton
                variant="ghost"
                icon={<AlertCircle size={16} />}
                onClick={() => setIsReportModalOpen(true)}
            >
                Signaler une erreur
            </ActionButton>
        </>
    );

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

            {/*
              * BREADCRUMBS (Schema.org)
              *
              * ⚠️ Doit rester IDENTIQUE au BreadcrumbList JSON-LD servi par
              * api/render.js (buildDecisionHead) : mêmes libellés, mêmes URLs,
              * même nombre de niveaux. Les deux balisages cohabitent dans le DOM.
              *
              * L'ancien maillon « chambre » pointait /search — la même URL
              * générique pour toutes les décisions, sans rapport avec le libellé
              * affiché. Supprimé : chaque maillon doit désigner sa propre page.
              */}
            <nav className="breadcrumbs" aria-label="Fil d'Ariane">
                <ol itemScope itemType="https://schema.org/BreadcrumbList">
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href="https://www.lexenegal.sn/"><span itemProp="name">Lexenegal</span></a>
                        <meta itemProp="position" content="1" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href="https://www.lexenegal.sn/jurisprudence"><span itemProp="name">Jurisprudence</span></a>
                        <meta itemProp="position" content="2" />
                    </li>
                    <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <a itemProp="item" href={`https://www.lexenegal.sn/decision/${slug}`}><span itemProp="name">{decision.reference || 'Décision'}</span></a>
                        <meta itemProp="position" content="3" />
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

                    <h1 className="decision-title">{[decision.juridiction, decision.reference, decision.chambre].filter(Boolean).join(' - ') || 'Décision'}</h1>
                    <div className="decision-ref">{decision.date_decision ? new Date(decision.date_decision).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Date N/D'}</div>

                    {/* Barre d'actions mobile/tablette (la colonne droite est masquée <1200px) */}
                    <div className="tools-mobile">
                        {decisionTools}
                    </div>

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
                                {decision.articles_loi_cites.map((art: string, i: number) => {
                                    const hit = citedResolved[art];
                                    return (
                                        <div key={i} className="law-citation">
                                            <span className="law-icon">§</span>{' '}
                                            {hit ? (
                                                <ArticleHoverPreview
                                                    articleId={hit.id}
                                                    articleNumber={hit.article_number}
                                                    codeName={hit.code_name}
                                                    codeSlug={hit.code_slug}
                                                    articleSlug={hit.slug}
                                                    date={hit.date}
                                                    ancien={hit.ancien}
                                                >
                                                    <a
                                                        href={`${urlArticle(hit.code_slug, hit.slug)}${requeteVersion(hit)}`}
                                                        className="article-link"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {art}
                                                    </a>
                                                </ArticleHoverPreview>
                                            ) : (
                                                art
                                            )}
                                        </div>
                                    );
                                })}
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

                    <RelatedDecisions slug={decision.slug} similaires={decision.decisions_similaires} />
                </main>

                {/* 3. RIGHT SIDEBAR */}
                <aside className="sidebar-right">
                    <div className="tools-sticky">
                        {decisionTools}
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
                        {/* Mêmes gardes que le PDF : pas de « du » orphelin, pas de date dupliquée (juricaf). */}
                        <h2>{decision.reference}{formattedDate && !(decision.reference || '').toLowerCase().includes(formattedDate.toLowerCase()) ? ` du ${formattedDate}` : ''}</h2>
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

                    {/* FOOTER */}
                    <div className="print-footer">
                        <div>Source : www.lexenegal.sn - édité le {new Date().toLocaleDateString('fr-FR')}</div>
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
