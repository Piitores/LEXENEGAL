import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useCopyAttribution } from '../../hooks/useCopyAttribution';
import { articleLabel } from '../../lib/articleLabel';
import { titreSeoArticle, descriptionSeoArticle } from '../../lib/seoArticle';
import { texteAvecIntitule } from '../../lib/intituleArticle';
import LinkedLegalContent from '../../components/LinkedLegalContent/LinkedLegalContent';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronLeft, ChevronRight,
    GitCompare, Clock, Scale, Lock, FileText, Gavel, AlertCircle, X, ExternalLink, BookOpen, Loader2, Printer
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO/SEO';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import ActionButton from '../../components/ui/ActionButton';
import CodeNavTree from '../../components/CodeNavTree/CodeNavTree';
import { estConvention, urlArticle, urlTexte } from '../../lib/urls';
import { slugDuTexte } from '../../lib/routeTexte';
import {
    chargerArticlesDuCode, chargerConcordanceArticle, chercherAncienSlug, COLONNES_ARBRE,
} from '../../lib/articlesDuCode';
import type { LigneConcordance } from '../../lib/articleRefResolver';
import {
    lireParamsVersion, requeteVersion, choisirVersions, versionCourante, normAncien, jourDe,
    libelleBandeauVersion, libelleVersionComparateur, libellePeriode, titreSectionVersion,
    referenceCopie, libelleNonRepris, autresSuccesseurs, numeroAncienAffiche, mentionAnciens, listeFr,
    dateCitationVersion, anciensNumerosCites,
    type VersionArticle,
} from '../../lib/versionsArticle';
import { numerotationPropreEnL } from '../../utils/articleLinkRenderer';
import {
    Article as CodeArticle, StructureNode, HierarchyNode,
    buildTreeFromNodes, buildTreeLegacy, getBreadcrumb, formatNodeLabel,
} from '../../lib/codeTree';
import './ArticlePage.css';
import '../../styles/legal-content.css';


interface Article {
    id: string;
    code_id: string;
    part_title: string;
    title_name: string;
    chapter_name: string;
    section_name: string;
    article_number: string;
    slug: string;
    modifications?: string[];
    content_raw?: string;
    notes?: string | null;
    status?: string | null;
    is_active?: boolean;
}

// Fusion des codes 2026 : `ancien_numero` distingue les versions reprises d'un ancien article
// (plusieurs prédécesseurs peuvent être en vigueur sur le même intervalle).
interface ArticleVersion extends VersionArticle {
    version_note: string | null;
}

interface Law {
    title: string;
    short_title?: string | null;
    slug: string;
    publication_date?: string | null;
    reference?: string | null;
    abrogation_note?: string | null;
    abrogated_by_slug?: string | null;
}

interface CitingDecision {
    id: string;
    titre: string;
    slug: string;
    date_decision: string;
    chambre: string;
    citation_text: string;
    /** Anciens numéros cités (« L.56. »), quand le lien a été reporté sur l'article 2026. */
    anciens_numeros: string[];
}

interface ArticleAnnotation {
    id: string;
    type: string;
    reference: string;
    date: string | null;
    title: string | null;
    content_raw: string;
}

interface DoctrineLink {
    doctrine_id: string;
    doctrine: {
        id: string;
        reference_complete: string;
        objet: string;
        content_raw?: string; // chargé à la demande pour un connecté (gate DB par colonne)
    }
}

// --- Diff mot à mot, conscient des balises HTML (aucune dépendance) ----------
// Tokenise : balises <...> (atomiques), mots, espaces. Compare par plus longue
// sous-séquence commune (LCS) et surligne les écarts SANS jamais couper une balise.
const tokenizeHtml = (html: string): string[] => html.match(/<[^>]+>|[^<\s]+|\s+/g) || [];
const isWord = (t: string): boolean => t.length > 0 && t[0] !== '<' && /\S/.test(t);

function diffVersions(oldHtml: string, newHtml: string): { oldHtml: string; newHtml: string } {
    const a = tokenizeHtml(oldHtml);
    const b = tokenizeHtml(newHtml);
    const n = a.length, m = b.length;
    // Garde-fou perf : sur un texte gigantesque, on ne tente pas le diff.
    if (n * m > 4_000_000) return { oldHtml, newHtml };
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let oldOut = '', newOut = '', i = 0, j = 0;
    const del = (t: string) => (isWord(t) ? `<mark class="diff-removed">${t}</mark>` : t);
    const ins = (t: string) => (isWord(t) ? `<mark class="diff-added">${t}</mark>` : t);
    while (i < n && j < m) {
        if (a[i] === b[j]) { oldOut += a[i]; newOut += b[j]; i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { oldOut += del(a[i]); i++; }
        else { newOut += ins(b[j]); j++; }
    }
    while (i < n) oldOut += del(a[i++]);
    while (j < m) newOut += ins(b[j++]);
    return { oldHtml: oldOut, newHtml: newOut };
}

const ArticlePage: React.FC = () => {
    // Slug en base du texte : /code/:codeSlug/…, ou /ccn/:segment/… pour une convention.
    const params = useParams();
    const codeSlug = slugDuTexte(params);
    const { articleSlug } = params;
    const navigate = useNavigate();
    // Version demandée par l'adresse (?date=AAAA-MM-JJ, ?ancien=L56) : fusion des codes 2026,
    // décision du propriétaire du 02/10/2026. Lien depuis une décision = version en vigueur à sa
    // date, visible de TOUS ; le canonical et le SEO restent ceux de la version courante.
    const location = useLocation();
    const paramsVersion = React.useMemo(() => lireParamsVersion(location.search), [location.search]);

    // « Retour au code » : on revient TOUJOURS à la page du code en cours de
    // consultation. (Auparavant un retour navigateur « intelligent » renvoyait vers
    // la page d'où l'on venait - souvent l'accueil du Corpus national - ce qui était
    // déroutant : le bouton est libellé « Retour au code », il doit mener au code.)
    const goBack = (fallback: string) => {
        navigate(fallback);
    };

    const [article, setArticle] = useState<Article | null>(null);
    const [law, setLaw] = useState<Law | null>(null);
    // Parties d'un même code (législative / réglementaire) pour la bascule.
    const [parties, setParties] = useState<{ slug: string; partie: string | null }[]>([]);

    // Toute copie de texte de l'article emporte la référence LexeSenegal + le lien.
    useCopyAttribution(codeSlug, law?.title);
    // Adresse publique du texte (src/lib/urls.ts : conventions sous /ccn/, le reste sous /code/).
    const adresseTexte = urlTexte(codeSlug || '');
    const [versions, setVersions] = useState<ArticleVersion[]>([]);
    const [currentVersion, setCurrentVersion] = useState<ArticleVersion | null>(null);
    // Lignes de concordance de l'article (ancien article non repris, autres successeurs).
    const [concordance, setConcordance] = useState<LigneConcordance[]>([]);
    // Le texte a sa propre numérotation en « L. » (Code électoral…) : ses « article L.28 » sans nom
    // de code sont les siens, pas ceux du Code du travail (numerotationPropreEnL, 02/10/2026).
    const [numerotationEnL, setNumerotationEnL] = useState(false);
    const [loading, setLoading] = useState(true);

    // Arbre de navigation (même mécanique que la page Code)
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [treeActiveNodeId, setTreeActiveNodeId] = useState<string | null>(null);
    const [nodePath, setNodePath] = useState<HierarchyNode[]>([]);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const toggleNode = (id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Navigation - previous/next articles
    const [prevArticle, setPrevArticle] = useState<{ slug: string; number: string } | null>(null);
    const [nextArticle, setNextArticle] = useState<{ slug: string; number: string } | null>(null);

    // Comparison mode
    const [showComparison, setShowComparison] = useState(false);
    const [compareVersion, setCompareVersion] = useState<ArticleVersion | null>(null);
    // Comparateur de versions = ouvert à tout compte connecté (cf. isAuthenticated).
    const [showConversionModal, setShowConversionModal] = useState(false);

    // Citing decisions
    const [citingDecisions, setCitingDecisions] = useState<CitingDecision[]>([]);
    const [loadingDecisions, setLoadingDecisions] = useState(false);

    // CGI Annotations & Doctrine
    const [annotations, setAnnotations] = useState<ArticleAnnotation[]>([]);
    const [doctrineLinks, setDoctrineLinks] = useState<DoctrineLink[]>([]);
    const [selectedDoctrine, setSelectedDoctrine] = useState<DoctrineLink['doctrine'] | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [doctrineOpen, setDoctrineOpen] = useState(false); // repliée par défaut
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Report Error Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);


    useEffect(() => {
        if (codeSlug && articleSlug) {
            fetchArticleData();
            checkProAccess();
        }
    }, [codeSlug, articleSlug]);

    // Ferme le tiroir « Sommaire » (mobile) quand on change d'article
    useEffect(() => { setMobileNavOpen(false); }, [articleSlug]);

    const checkProAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        } catch (error) {
            console.error('Error checking auth:', error);
        }
    };

    const fetchArticleData = async () => {
        setLoading(true);
        setPrevArticle(null);
        setNextArticle(null);
        setConcordance([]);
        // Ancienne adresse redirigée : le chargement continue sur la nouvelle (pas de « non trouvé »).
        let redirige = false;

        try {
            // Get law info
            const { data: lawData } = await supabase
                .from('laws_and_codes')
                .select('id, title, short_title, slug, category, publication_date, reference, abrogation_note, abrogated_by_slug, code_famille, partie')
                .eq('slug', codeSlug)
                .single();

            if (lawData) {
                setLaw(lawData);

                // Parties sœurs (option A) pour la bascule Législative / Réglementaire.
                const famille = (lawData as any).code_famille as string | null;
                if (famille) {
                    const { data: sib } = await supabase
                        .from('laws_and_codes')
                        .select('slug, partie')
                        .eq('code_famille', famille)
                        .eq('is_active', true);
                    setParties((sib || []).sort(
                        (a, b) => (a.partie === 'legislative' ? 0 : 1) - (b.partie === 'legislative' ? 0 : 1)
                    ));
                } else {
                    setParties([]);
                }

                // Get article
                const { data: articleData } = await supabase
                    .from('articles')
                    .select(`${COLONNES_ARBRE}, code_id, content_raw, modifications, notes`)
                    .eq('code_id', lawData.id)
                    .eq('slug', articleSlug)
                    .maybeSingle();

                // Fusion des codes 2026 : l'ancien article repris ou éclaté n'existe plus ; son
                // adresse (article-l56) mène à l'article qui en a repris le sujet (ligne « principal »
                // de la concordance), dans la rédaction de l'ancien article. Rien dans la
                // concordance (ou lecture en échec) : « Article non trouvé », comme avant.
                if (!articleData && articleSlug) {
                    const cible = await chercherAncienSlug(lawData.id, articleSlug);
                    if (cible && cible.slug !== articleSlug) {
                        redirige = true;
                        const requete = requeteVersion({ ancien: cible.ancienNorm, date: paramsVersion.date });
                        navigate(`${urlArticle(codeSlug || '', cible.slug)}${requete}${location.hash}`, { replace: true });
                        return;
                    }
                }

                if (articleData) {
                    setArticle(articleData as unknown as Article);

                    // Arbre de navigation du code (même mécanique que CodePage) : colonnes
                    // LÉGÈRES (sans le contenu des articles, inutile ici) et lecture PAGINÉE
                    // (au-delà de 1 000 articles, la fin du code manquait à l'arbre).
                    // Un échec ne doit pas priver le lecteur de l'article : l'arbre reste vide.
                    const [allArts, { data: nodesData }] = await Promise.all([
                        chargerArticlesDuCode<CodeArticle>(lawData.id, COLONNES_ARBRE)
                            .catch((e) => { console.error('Error fetching code tree:', e); return [] as CodeArticle[]; }),
                        supabase
                            .from('structure_nodes')
                            .select('*')
                            .eq('code_id', lawData.id)
                            .order('position'),
                    ]);
                    const tree = (nodesData && nodesData.length > 0)
                        ? buildTreeFromNodes(nodesData as StructureNode[], allArts)
                        : buildTreeLegacy(allArts);
                    setHierarchy(tree);
                    setNumerotationEnL(numerotationPropreEnL(codeSlug, allArts.map(a => a.article_number)));
                    setTreeActiveNodeId(articleData.node_id ?? null);
                    if (articleData.node_id) {
                        const path = getBreadcrumb(articleData.node_id, tree) || [];
                        setExpandedNodes(new Set(path.map(p => p.id)));
                        setNodePath(path);
                    } else {
                        setExpandedNodes(new Set());
                        setNodePath([]);
                    }

                    // Get versions
                    const { data: versionsData } = await supabase
                        .from('article_versions')
                        .select('*')
                        .eq('article_id', articleData.id)
                        .order('effective_date', { ascending: false });

                    if (versionsData && versionsData.length > 0) {
                        setVersions(versionsData);
                        // La plus récente des is_current, sinon la plus récente (versionCourante).
                        setCurrentVersion(versionCourante(versionsData as ArticleVersion[]));
                    } else if (articleData.content_raw) {
                        setVersions([]);
                        // Fallback (articles sans versions, ex. CGI) : « en vigueur depuis »
                        // = date d'institution du code (publication_date), pas la date du jour.
                        setCurrentVersion({
                            id: `raw-${articleData.id}`,
                            content: articleData.content_raw,
                            effective_date: lawData.publication_date || new Date().toISOString(),
                            expiration_date: null,
                            version_note: null,
                            is_current: true
                        });
                    }

                    // Article précédent / suivant : voisins dans la liste déjà chargée, triée
                    // par display_order puis id. (Les requêtes « display_order < / > » sautaient
                    // les articles de même rang : le Code de procédure pénale compte 923 articles
                    // pour 834 rangs.)
                    const rang = allArts.findIndex(a => a.id === articleData.id);
                    const prevData = rang > 0 ? allArts[rang - 1] : null;
                    const nextData = rang >= 0 && rang < allArts.length - 1 ? allArts[rang + 1] : null;
                    if (prevData) {
                        setPrevArticle({ slug: prevData.slug, number: prevData.article_number });
                    }
                    if (nextData) {
                        setNextArticle({ slug: nextData.slug, number: nextData.article_number });
                    }

                    // Concordance (fusion des codes 2026), lue seulement quand elle peut servir : un
                    // article abrogé (ancien article non repris ?) ou des versions reprises d'un
                    // ancien article. Échec : [] (pas de bandeau, jamais de page cassée).
                    const anciensNorms = (versionsData || [])
                        .map((v: any) => normAncien(v.ancien_numero))
                        .filter(Boolean);
                    if (articleData.status === 'abrogé' || anciensNorms.length) {
                        setConcordance(await chargerConcordanceArticle(lawData.id, articleData.id, anciensNorms));
                    }

                    // Fetch citing decisions
                    fetchCitingDecisions(articleData.id);

                    // Fetch annotations
                    const { data: annoData } = await supabase
                        .from('article_annotations')
                        .select('*')
                        .eq('article_id', articleData.id)
                        .order('created_at', { ascending: true });
                    if (annoData) setAnnotations(annoData);

                    // Fetch doctrine links
                    const { data: doctrineData } = await supabase
                        .from('article_doctrine_links')
                        .select(`
                            doctrine_id,
                            doctrine:doctrine(id, reference_complete, objet)
                        `)
                        .eq('article_id', articleData.id);
                    if (doctrineData) setDoctrineLinks(doctrineData as unknown as DoctrineLink[]);
                }
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            if (!redirige) setLoading(false);
        }
    };

    const fetchCitingDecisions = async (articleId: string) => {
        setLoadingDecisions(true);
        try {
            // Décisions les plus récentes d'abord (tri sur la table liée, côté PostgREST) : après la
            // fusion des codes 2026, art-137 hérite de toutes les décisions qui citaient L.56, et
            // `.limit(10)` sans ordre en gardait 10 au hasard. Repli sur la lecture d'avant (sans
            // anciens numéros), triée ici, si la requête triée échoue.
            const decisionsLiees = 'decision:decisions(id, reference, slug, date_decision, chambre)';
            const triee = await supabase
                .from('decision_article_links')
                .select(`citation_text, anciens_numeros, ${decisionsLiees}`)
                .eq('article_id', articleId)
                .order('decision(date_decision)', { ascending: false, nullsFirst: false })
                .limit(10);
            const lecture = triee.error
                ? await supabase
                    .from('decision_article_links')
                    .select(`citation_text, ${decisionsLiees}`)
                    .eq('article_id', articleId)
                    .limit(10)
                : triee;
            const { data: links, error } = lecture;

            if (error) throw error;

            const decisions: CitingDecision[] = ((links || []) as any[])
                .filter((l: any) => l.decision)
                .map((l: any) => ({
                    id: l.decision.id,
                    titre: l.decision.reference,
                    slug: l.decision.slug,
                    date_decision: l.decision.date_decision,
                    chambre: l.decision.chambre,
                    citation_text: l.citation_text,
                    anciens_numeros: Array.isArray(l.anciens_numeros) ? l.anciens_numeros.filter(Boolean) : [],
                }))
                .sort((a, b) => (b.date_decision || '').localeCompare(a.date_decision || ''));

            setCitingDecisions(decisions);
        } catch (error) {
            console.error('Error fetching citing decisions:', error);
        } finally {
            setLoadingDecisions(false);
        }
    };


    const handleCompareClick = () => {
        if (!isAuthenticated) {
            setShowConversionModal(true);
            return;
        }
        // En mode daté, le comparateur s'ouvre sur la version affichée (comparée à l'actuelle).
        if (!showComparison && !compareVersion && !choix.estActuelle) {
            setCompareVersion(choix.versions.find((v) => v.id !== currentVersion?.id) ?? null);
        }
        setShowComparison(!showComparison);
    };

    const selectCompareVersion = (version: ArticleVersion) => {
        setCompareVersion(version);
    };

    // Simple diff renderer
    const renderDiff = (oldText: string, newText: string) => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');

        return (
            <div className="diff-content">
                {newLines.map((line, i) => {
                    const oldLine = oldLines[i] || '';
                    const isAdded = !oldLines.includes(line) && line.trim();
                    const isRemoved = !newLines.includes(oldLine) && oldLine.trim();

                    return (
                        <p
                            key={i}
                            className={`diff-line ${isAdded ? 'diff-added' : ''}`}
                        >
                            {line || '\u00A0'}
                        </p>
                    );
                })}
            </div>
        );
    };

    const handleDoctrineClick = async (doctrine: DoctrineLink['doctrine']) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        // Ouvre d'abord (teaser), puis charge le corps à la demande. Le gate réel
        // est en base : un anon ne peut pas lire content_raw (migration colonne).
        setSelectedDoctrine(doctrine);
        if (doctrine.content_raw === undefined) {
            const { data } = await supabase
                .from('doctrine')
                .select('content_raw')
                .eq('id', doctrine.id)
                .single();
            if (data?.content_raw != null) {
                setSelectedDoctrine((prev) =>
                    prev && prev.id === doctrine.id ? { ...prev, content_raw: data.content_raw } : prev
                );
            }
        }
    };

    // Version(s) affichée(s) pour l'adresse consultée (contrat de la fusion, §3). Sans paramètre :
    // la version courante, exactement comme avant. L'article sans versions (repli content_raw) n'a
    // que sa version courante.
    const versionsBase: ArticleVersion[] = versions.length ? versions : (currentVersion ? [currentVersion] : []);
    const choix = React.useMemo(
        () => choisirVersions(versionsBase, paramsVersion, article?.article_number),
        [versionsBase, paramsVersion, article?.article_number]
    );
    const versionsAffichees: ArticleVersion[] = choix.estActuelle
        ? (currentVersion ? [currentVersion] : [])
        : choix.versions;
    const bandeauVersion = libelleBandeauVersion(choix, paramsVersion, versionsBase, article?.article_number);
    const autresReprises = article && !choix.estActuelle ? autresSuccesseurs(concordance, choix.versions, article.id) : [];
    // Ancien article NON REPRIS par le code refondu (ligne « identite » de la concordance).
    const estNonRepris = !!article && concordance.some((l) => l.role === 'identite' && l.article_id === article.id);
    // Bascule de numérotation : fin de l'ancienne (concordance), à défaut entrée en vigueur de la
    // version courante. Une décision antérieure citait l'ancien texte.
    const bascule = jourDe(concordance.find((l) => l.en_vigueur_jusqu_au)?.en_vigueur_jusqu_au)
        || jourDe(currentVersion?.effective_date);
    // Début de l'ancienne numérotation : avant, le numéro visait un code plus ancien (non
    // transposable), on ne propose pas de « texte alors en vigueur ».
    const numerotationDepuis = jourDe(concordance.find((l) => l.numerotation_depuis)?.numerotation_depuis);

    // Diff surligné entre l'ancienne version sélectionnée et la version courante.
    const diff = React.useMemo(
        () => (showComparison && compareVersion && currentVersion)
            ? diffVersions(compareVersion.content, currentVersion.content)
            : null,
        [showComparison, compareVersion, currentVersion]
    );

    if (loading) {
        return (
            <div className="article-page article-loading">
                <div className="loading-spinner" />
                <p>Chargement de l'article...</p>
            </div>
        );
    }

    if (!article || !currentVersion) {
        return (
            <div className="article-page article-not-found">
                <h2>Article non trouvé</h2>
                <button onClick={() => goBack(adresseTexte)}>Retour au code</button>
            </div>
        );
    }

    // Copie avec attribution : en mode daté, la référence dit quelle version a été copiée et
    // l'adresse porte ses paramètres (useCopyAttribution lit data-art-query).
    const copie = referenceCopie(articleLabel(article), choix, paramsVersion, versionsBase, article.article_number);
    // Date des citations d'un texte affiché (renvois d'un code refondu) : celle d'une version
    // reprise d'un ancien article est sa date d'effet, jamais antérieure au début de l'ancienne
    // numérotation ; sinon la date de publication du texte (dateCitationVersion).
    const dateDeCitation = (v: ArticleVersion): string | null =>
        dateCitationVersion(v, law?.publication_date, numerotationDepuis);

    return (
        <div className="article-page">
            <SEO
                title={titreSeoArticle(article, law ?? {})}
                description={descriptionSeoArticle(article, law ?? {}, texteAvecIntitule(currentVersion.content, (h) => h.replace(/<[^>]+>/g, ' ')))}
                url={`https://www.lexenegal.sn${urlArticle(codeSlug || '', article.slug)}`}
            />

            <div className="article-layout">
                {/* ARBRE DE NAVIGATION (gauche) - même composant que la page Code.
                    Desktop : colonne fixe. Mobile : tiroir « Sommaire » ouvrable. */}
                {hierarchy.length > 0 && (
                    <>
                        {mobileNavOpen && (
                            <div className="article-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
                        )}
                        <aside className={`article-tree-aside ${mobileNavOpen ? 'is-open' : ''}`}>
                            <div className="article-tree-aside__mhead">
                                <span>Sommaire</span>
                                <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le sommaire">
                                    <X size={18} />
                                </button>
                            </div>
                            <CodeNavTree
                                nodes={hierarchy}
                                slug={codeSlug}
                                expandedNodes={expandedNodes}
                                onToggle={toggleNode}
                                onSelect={(node) => { setMobileNavOpen(false); navigate(`${adresseTexte}?node=${encodeURIComponent(node.name)}`); }}
                                activeNodeId={treeActiveNodeId}
                                activeArticleSlug={article.slug}
                            />
                        </aside>
                    </>
                )}

                <div className="article-container">
                {/* Bouton « Sommaire » (mobile uniquement) pour ouvrir l'arbre */}
                {hierarchy.length > 0 && (
                    <button type="button" className="article-nav-toggle" onClick={() => setMobileNavOpen(true)}>
                        <BookOpen size={16} /> Sommaire
                    </button>
                )}
                {/* BREADCRUMB - minimal et raffiné */}
                <nav className="article-breadcrumb">
                    {estConvention(codeSlug)
                        ? <Link to="/conventions-collectives">Conventions collectives</Link>
                        : <Link to="/codes">Codes</Link>}
                    <ChevronRight size={13} />
                    <Link to={adresseTexte}>{law?.title}</Link>
                    <ChevronRight size={13} />
                    <span className="bc-current">{articleLabel(article)}</span>
                </nav>

                {parties.length > 1 && (
                    <div className="partie-toggle" role="tablist" aria-label="Partie du code">
                        {parties.map((p) => {
                            const actif = p.slug === codeSlug;
                            const label = p.partie === 'reglementaire' ? 'Réglementaire' : 'Législative';
                            return actif ? (
                                <span key={p.slug} className="partie-toggle__btn actif" role="tab" aria-selected="true">{label}</span>
                            ) : (
                                <Link key={p.slug} to={urlTexte(p.slug)} className="partie-toggle__btn" role="tab" aria-selected="false">{label}</Link>
                            );
                        })}
                    </div>
                )}

                {/* BANDEAU ABROGATION (texte entier abrogé par un autre texte) */}
                {law?.abrogation_note && (
                    <div className="law-abrogation-banner" role="note">
                        <span className="lab-icon" aria-hidden="true">⛔</span>
                        <span>{law.abrogation_note}{law.abrogated_by_slug && (
                            <> <Link to={urlTexte(law.abrogated_by_slug)}>Voir le texte en vigueur →</Link></>
                        )}</span>
                    </div>
                )}

                {/* BANDEAU ABROGATION (article individuel abrogé). Ancien article non repris par le
                    code refondu (fusion des codes 2026) : texte construit à partir de la référence du
                    texte, jamais tiré de `notes`. */}
                {(article.status === 'abrogé' || article.is_active === false) && (
                    <div className="article-abrogation-banner" role="note">
                        <span className="lab-icon" aria-hidden="true">⛔</span>
                        <span>{estNonRepris ? libelleNonRepris(law?.reference) : (article.notes || 'Cet article a été abrogé.')}</span>
                    </div>
                )}

                {/* BANDEAU DE VERSION (fusion des codes 2026) : la version affichée n'est pas la
                    version actuelle (lien daté depuis une décision, ancienne adresse). VISIBLE DE
                    TOUS, hors de tout verrou de connexion. */}
                {bandeauVersion && (
                    <div className="article-version-banner" role="note">
                        <Clock size={16} className="avb-icon" aria-hidden="true" />
                        <div className="avb-texte">
                            <p>
                                {bandeauVersion} - <Link to={urlArticle(codeSlug || '', article.slug)}>voir la version actuelle</Link>
                            </p>
                            {autresReprises.map((r) => (
                                <p key={r.ancienNorm}>
                                    Le texte de l'ancien article {r.ancienAffiche} est aussi repris {r.articles.length > 1 ? 'aux articles' : "à l'article"}{' '}
                                    {r.articles.map((a, i) => (
                                        <React.Fragment key={a.slug}>
                                            {i > 0 && (i === r.articles.length - 1 ? ' et ' : ', ')}
                                            <Link to={`${urlArticle(codeSlug || '', a.slug)}${requeteVersion({ ancien: r.ancienNorm, date: paramsVersion.date })}`}>
                                                {a.article_number}
                                            </Link>
                                        </React.Fragment>
                                    ))}.
                                </p>
                            ))}
                        </div>
                    </div>
                )}

                {/* HEADER */}
                <header className="article-header">
                    {/* Fil d'Ariane complet depuis l'arbre (Partie › Livre › Titre › Chapitre › Section › Paragraphe),
                        chaque niveau avec son mot. Construit depuis structure_nodes (et non les champs plats). */}
                    {(() => {
                        if (!nodePath.length) return null;
                        return (
                            <div className="article-hierarchy" aria-label="Emplacement dans le code">
                                {nodePath.map((n) => {
                                    const { badge, label } = formatNodeLabel(n);
                                    return (
                                        <Link
                                            key={n.id}
                                            className={`ah-row ah-row--${n.type}`}
                                            to={`${adresseTexte}?node=${encodeURIComponent(n.name)}`}
                                        >
                                            {badge && <span className={`ah-badge ah-badge--${n.type}`}>{badge}</span>}
                                            <span className="ah-label">{label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })()}
                    <h1>{articleLabel(article)}
                        {article.notes && article.status !== 'abrogé' && article.is_active !== false && (
                            <span className="article-nota" tabIndex={0} role="note" aria-label={`Note : ${article.notes}`}>
                                <span className="article-nota__mark">!</span>
                                <span className="article-nota__tip">{article.notes}</span>
                            </span>
                        )}
                    </h1>

                    {/* VERSION INFO */}
                    <div className="version-info-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                        <div className="version-info" style={{ margin: 0 }}>
                            <Clock size={14} />
                            {choix.estActuelle ? (
                                <>
                                    {/* Version qui a une date de fin (ancien article non repris, abrogé le
                                        03/09/2026) : « En vigueur du … au … », jamais « en vigueur depuis »
                                        pour un texte qui ne l'est plus (constaté en production, 02/10/2026). */}
                                    {currentVersion.expiration_date
                                        ? libellePeriode(currentVersion, versionsBase, article.article_number)
                                        : `En vigueur depuis le ${new Date(currentVersion.effective_date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}`}
                                    {currentVersion.version_note && (
                                        <span className="version-note"> · {currentVersion.version_note}</span>
                                    )}
                                </>
                            ) : (
                                // Version antérieure affichée : sa période (« En vigueur du … au … »).
                                <>
                                    {libellePeriode(versionsAffichees[0], versionsBase, article.article_number)}
                                    {versionsAffichees.length === 1 && versionsAffichees[0].version_note && (
                                        <span className="version-note"> · {versionsAffichees[0].version_note}</span>
                                    )}
                                </>
                            )}
                        </div>

                        {/* MODIFICATIONS INFO (Légifrance Style) */}
                        {article.modifications && article.modifications.length > 0 && (
                            <div className="article-modifications" style={{ textAlign: 'right', fontSize: '0.85rem', color: '#2563EB' }}>
                                <a href="#" style={{ textDecoration: 'underline', color: 'inherit' }}>
                                    {article.modifications[article.modifications.length - 1]}
                                </a>
                            </div>
                        )}
                    </div>
                </header>

                {/* ACTIONS */}
                <div className="article-actions">
                    <ActionButton
                        variant="secondary"
                        icon={<Printer size={16} />}
                        onClick={() => window.print()}
                    >
                        Imprimer l'article
                    </ActionButton>
                    <ActionButton
                        variant="secondary"
                        icon={<GitCompare size={16} />}
                        className={showComparison ? 'active' : ''}
                        onClick={handleCompareClick}
                    >
                        Comparer les versions
                        {!isAuthenticated && <Lock size={12} className="pro-lock" />}
                    </ActionButton>
                    <ActionButton
                        variant="ghost"
                        icon={<AlertCircle size={16} />}
                        onClick={() => setIsReportModalOpen(true)}
                    >
                        Signaler une erreur
                    </ActionButton>
                </div>

                {/* COMPARISON MODE */}
                <AnimatePresence>
                    {showComparison && isAuthenticated && (
                        <motion.div
                            className="comparison-panel"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="version-selector">
                                <label>Comparer avec :</label>
                                <select
                                    value={compareVersion?.id || ''}
                                    onChange={(e) => {
                                        const v = versions.find(v => v.id === e.target.value);
                                        setCompareVersion(v || null);
                                    }}
                                >
                                    <option value="">Sélectionner une version...</option>
                                    {/* Toutes les versions sauf la courante : filtre par id (les versions
                                        reprises d'un ancien article peuvent porter is_current). */}
                                    {versions.filter(v => v.id !== currentVersion.id).map(v => (
                                        <option key={v.id} value={v.id}>
                                            {libelleVersionComparateur(v)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTENT */}
                <div
                    className={`article-content-wrapper ${showComparison && compareVersion ? 'side-by-side' : ''} ${(article.status === 'abrogé' || article.is_active === false) ? 'is-abroge' : ''}`}
                    data-art-slug={articleSlug}
                    data-art-num={copie.num}
                    data-art-query={copie.requete || undefined}
                >
                    {showComparison && compareVersion && isAuthenticated ? (
                        <>
                            {/* OLD VERSION */}
                            <div className="version-column version-old">
                                <div className="version-column-header">
                                    <FileText size={14} />
                                    {libelleVersionComparateur(compareVersion)}
                                </div>
                                <div
                                    className="article-text"
                                    dangerouslySetInnerHTML={{ __html: diff ? diff.oldHtml : compareVersion.content }}
                                />
                            </div>

                            {/* CURRENT VERSION */}
                            <div className="version-column version-current">
                                <div className="version-column-header current">
                                    <FileText size={14} />
                                    Version actuelle
                                </div>
                                <div
                                    className="article-text"
                                    dangerouslySetInnerHTML={{ __html: diff ? diff.newHtml : currentVersion.content }}
                                />
                            </div>
                        </>
                    ) : versionsAffichees.length > 1 ? (
                        // Plusieurs prédécesseurs en vigueur à la date : une section par version.
                        versionsAffichees.map((v) => (
                            <section key={v.id} className="article-version-section">
                                <h2 className="article-version-section__titre">
                                    {titreSectionVersion(v, articleLabel(article))}
                                    <span className="article-version-section__periode">{libellePeriode(v, versionsBase, article.article_number)}</span>
                                </h2>
                                <LinkedLegalContent className="article-text" html={v.content} dateCitation={dateDeCitation(v)} numerotationPropreEnL={numerotationEnL} />
                            </section>
                        ))
                    ) : (
                        <LinkedLegalContent className="article-text" html={(versionsAffichees[0] ?? currentVersion).content} dateCitation={dateDeCitation(versionsAffichees[0] ?? currentVersion)} numerotationPropreEnL={numerotationEnL} />
                    )}

                    {/* ANNOTATIONS (Pastilles grises du CGI) */}
                    {annotations.length > 0 && !showComparison && (
                        <div className="article-annotations-container">
                            {annotations.map(anno => (
                                <div key={anno.id} className="article-annotation">
                                    {anno.title && <h4>{anno.title}</h4>}
                                    <LinkedLegalContent className="annotation-content" html={anno.content_raw} dateCitation={law?.publication_date} numerotationPropreEnL={numerotationEnL} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* DOCTRINE FISCALE */}
                {doctrineLinks.length > 0 && (
                    <section className="citing-decisions doctrine-section">
                        <h2 onClick={() => setDoctrineOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={20} />
                            Doctrine Fiscale liée
                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6B7280' }}>({doctrineLinks.length})</span>
                            <ChevronRight size={18} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: doctrineOpen ? 'rotate(90deg)' : 'none' }} />
                        </h2>
                        {doctrineOpen && (
                        <div className="citing-list">
                            {doctrineLinks.map(link => (
                                <button
                                    key={link.doctrine_id}
                                    onClick={() => handleDoctrineClick(link.doctrine)}
                                    className="citing-card doctrine-card"
                                >
                                    <div className="citing-card__icon">
                                        <FileText size={16} />
                                    </div>
                                    <div className="citing-card__content text-left">
                                        <h3>{link.doctrine.reference_complete || 'Lettre de la DGID'}</h3>
                                        {link.doctrine.objet && (
                                            <p className="citing-card__meta">
                                                Objet : {link.doctrine.objet}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="citing-card__arrow" />
                                </button>
                            ))}
                        </div>
                        )}
                    </section>
                )}

                {/* CITING DECISIONS */}
                <section className="citing-decisions">
                    <h2>
                        <Gavel size={20} />
                        Décisions citant cet article
                    </h2>
                    {loadingDecisions ? (
                        <p className="citing-loading">Chargement...</p>
                    ) : citingDecisions.length === 0 ? (
                        <p className="citing-empty">
                            Aucune décision ne cite cet article pour le moment.
                        </p>
                    ) : (
                        <div className="citing-list">
                            {citingDecisions.map(decision => {
                                // Décision antérieure à la bascule qui citait un ancien numéro (lien
                                // reporté par la fusion des codes 2026) : on le dit, et on mène au texte
                                // alors en vigueur (?ancien=&date=). Le numéro de l'article affiché
                                // lui-même (ancien article non repris) n'apprend rien : écarté.
                                const anciensCites = anciensNumerosCites(decision.anciens_numeros, article.article_number);
                                const anciens = anciensCites.map(numeroAncienAffiche).filter(Boolean);
                                const jour = jourDe(decision.date_decision);
                                const avantBascule = anciens.length > 0 && !!jour && !!bascule && jour < bascule;
                                const texteAlors = avantBascule && !(numerotationDepuis && jour < numerotationDepuis)
                                    ? `${urlArticle(codeSlug || '', article.slug)}${requeteVersion({
                                        ancien: anciensCites.length === 1 ? anciensCites[0] : null,
                                        date: jour,
                                    })}`
                                    : null;
                                return (
                                    <React.Fragment key={decision.id}>
                                        <Link
                                            to={`/decision/${decision.slug}`}
                                            className="citing-card"
                                        >
                                            <div className="citing-card__icon">
                                                <Scale size={16} />
                                            </div>
                                            <div className="citing-card__content">
                                                <h3>{decision.titre}</h3>
                                                <p className="citing-card__meta">
                                                    {decision.chambre} · {new Date(decision.date_decision).toLocaleDateString('fr-FR')}
                                                    {avantBascule && ` · cite ${mentionAnciens(anciens)}`}
                                                </p>
                                                {decision.citation_text && (
                                                    <p className="citing-card__excerpt">
                                                        "...{decision.citation_text}..."
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRight size={16} className="citing-card__arrow" />
                                        </Link>
                                        {texteAlors && (
                                            <Link to={texteAlors} className="citing-card__version">
                                                Texte alors en vigueur ({anciens.length > 1 ? `anciens articles ${listeFr(anciens)}` : `ancien article ${anciens[0]}`}, {new Date(decision.date_decision).toLocaleDateString('fr-FR')})
                                            </Link>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* NAVIGATION */}
                <div className="article-nav">
                    <button
                        className={`btn-nav ${!prevArticle ? 'disabled' : ''}`}
                        onClick={() => prevArticle && navigate(urlArticle(codeSlug || '', prevArticle.slug))}
                        disabled={!prevArticle}
                    >
                        <ChevronLeft size={16} />
                        {prevArticle ? articleLabel({ article_number: prevArticle.number }) : 'Premier article'}
                    </button>
                    <button className="btn-nav btn-nav-center" onClick={() => goBack(adresseTexte)}>
                        Retour
                    </button>
                    <button
                        className={`btn-nav ${!nextArticle ? 'disabled' : ''}`}
                        onClick={() => nextArticle && navigate(urlArticle(codeSlug || '', nextArticle.slug))}
                        disabled={!nextArticle}
                    >
                        {nextArticle ? articleLabel({ article_number: nextArticle.number }) : 'Dernier article'}
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* SIGNATURE */}
                <div className="article-signature">
                    LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
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

            {/* REPORT ERROR MODAL */}
            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="article"
                entityId={article?.id}
                url={window.location.href}
            />

            {/* DOCTRINE SIDEBAR */}
            <AnimatePresence>
                {selectedDoctrine && (
                    <>
                        <motion.div 
                            className="doctrine-sidebar-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDoctrine(null)}
                        />
                        <motion.div
                            className="doctrine-sidebar"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        >
                            <div className="doctrine-sidebar-header">
                                <h3>Doctrine Fiscale</h3>
                                <div className="doctrine-sidebar-actions">
                                    <button 
                                        className="doctrine-sidebar-btn" 
                                        title="Ouvrir dans un nouvel onglet"
                                        onClick={() => window.open('/doctrine-fiscale', '_blank')}
                                    >
                                        <ExternalLink size={18} />
                                    </button>
                                    <button className="doctrine-sidebar-btn close" onClick={() => setSelectedDoctrine(null)}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="doctrine-sidebar-content">
                                <h2 className="doctrine-title">{selectedDoctrine.reference_complete || 'Lettre de la DGID'}</h2>
                                {selectedDoctrine.objet && (
                                    <div className="doctrine-meta">
                                        <strong>Objet :</strong> {selectedDoctrine.objet}
                                    </div>
                                )}
                                {selectedDoctrine.content_raw !== undefined ? (
                                    <div
                                        className="doctrine-text"
                                        dangerouslySetInnerHTML={{
                                            __html: selectedDoctrine.content_raw.replace(/\n/g, '<br />')
                                        }}
                                    />
                                ) : (
                                    <div className="doctrine-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
                                        <Loader2 size={18} className="spinner" /> Chargement du texte…
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* AUTH REQUIRED MODAL */}
            <AnimatePresence>
                {showAuthModal && (
                    <div className="modal-overlay auth-modal-overlay">
                        <motion.div 
                            className="modal-content auth-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <button className="modal-close" onClick={() => setShowAuthModal(false)}>
                                <X size={20} />
                            </button>
                            <div className="auth-modal-icon">
                                <Lock size={32} />
                            </div>
                            <h2>Connexion Requise</h2>
                            <p>
                                La consultation de la Doctrine Fiscale intégrale est réservée aux utilisateurs Lexenegal.
                                Créez un compte gratuitement ou connectez-vous pour y accéder.
                            </p>
                            <div className="auth-modal-actions">
                                <button className="btn-primary" onClick={() => navigate('/login')}>
                                    Se connecter / S'inscrire
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ArticlePage;
