import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuth from '../../hooks/useAuth';
import { Loader2, ArrowLeft, Building, Calendar, FileText, Lock, BookOpen, Copy, AlertCircle } from 'lucide-react';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import ActionButton from '../../components/ui/ActionButton';
import { formatDoctrineDate } from '../../lib/doctrineDate';
import './DoctrinePage.css';
import './DoctrineDetailPage.css';

interface DoctrineDetail {
    id: string;
    slug: string;
    numero: string;
    annee: number;
    date: string;
    service_emetteur: string;
    reference_complete: string;
    objet: string;
    destinataire: string;
    signataire: string;
}

// Teaser public (content_raw EXCLU : gate DB par colonne, migration doctrine_gate_content_raw_columns).
const TEASER_COLUMNS = 'id, slug, numero, annee, date, service_emetteur, reference_complete, objet, destinataire, signataire';

const DoctrineDetailPage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { loading: authLoading, isConnected } = useAuth();
    // En dev local on débloque la consultation (import.meta.env.DEV = false en prod).
    const canRead = isConnected || import.meta.env.DEV;

    const [doctrine, setDoctrine] = useState<DoctrineDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState<string | null>(null);
    const [loadingBody, setLoadingBody] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Teaser : chargé pour tout le monde (objet, référence, métadonnées).
    useEffect(() => {
        let active = true;
        setLoading(true);
        setNotFound(false);
        (async () => {
            const { data, error } = await supabase
                .from('doctrine')
                .select(TEASER_COLUMNS)
                .eq('slug', slug)
                .maybeSingle();
            if (!active) return;
            if (error || !data) {
                // Slug inconnu : peut-être un ancien slug (refonte SEO) → redirection vers le nouveau.
                const { data: redir } = await supabase
                    .from('doctrine_slug_redirects')
                    .select('new_slug')
                    .eq('old_slug', slug)
                    .maybeSingle();
                if (!active) return;
                if (redir?.new_slug && redir.new_slug !== slug) {
                    navigate(`/doctrine-fiscale/${redir.new_slug}`, { replace: true });
                    return;
                }
                setNotFound(true);
            } else setDoctrine(data as DoctrineDetail);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [slug]);

    // Titre de page côté SPA (le SSR sert déjà le <head> complet aux crawlers).
    useEffect(() => {
        if (doctrine) {
            const ref = doctrine.reference_complete || (doctrine.numero ? `Lettre n° ${doctrine.numero}` : 'Doctrine fiscale');
            document.title = `${doctrine.objet ? `${doctrine.objet} - ` : ''}${ref} | Doctrine fiscale | Lexenegal`;
        }
        return () => { document.title = 'Lexenegal'; };
    }, [doctrine]);

    // Corps (content_raw) chargé à la demande, SEULEMENT pour un membre (gate réel en base).
    useEffect(() => {
        if (!doctrine || !canRead || authLoading || body !== null) return;
        let active = true;
        setLoadingBody(true);
        (async () => {
            const { data } = await supabase
                .from('doctrine')
                .select('content_raw')
                .eq('id', doctrine.id)
                .single();
            if (!active) return;
            setBody((data?.content_raw as string) ?? '');
            setLoadingBody(false);
        })();
        return () => { active = false; };
    }, [doctrine, canRead, authLoading, body]);

    const paragraphs = useMemo(
        () => (body || '').split('\n').map((p) => p.trim()),
        [body]
    );

    const ref = doctrine?.reference_complete || (doctrine?.numero ? `Lettre n° ${doctrine.numero}` : 'Doctrine fiscale');

    return (
        <div className="doctrine-page doctrine-detail">
            <div className="doctrine-detail__container">
                <Link to="/doctrine-fiscale" className="doctrine-detail__back">
                    <ArrowLeft size={18} /> Toute la doctrine fiscale
                </Link>

                {loading ? (
                    <div className="doctrine-loading">
                        <Loader2 size={40} className="spinner" />
                        <p>Chargement…</p>
                    </div>
                ) : notFound ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
                        <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                        <h3>Document introuvable</h3>
                        <p>Cette lettre de doctrine n'existe pas ou a été retirée.</p>
                        <Link to="/doctrine-fiscale" className="doctrine-detail__cta" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
                            Parcourir la doctrine fiscale
                        </Link>
                    </div>
                ) : doctrine && (
                    <article className="doctrine-detail__card">
                        <header className="doctrine-detail__header">
                            <span className="doctrine-detail__eyebrow">
                                <BookOpen size={14} /> Doctrine fiscale · DGID
                            </span>
                            <h1>{doctrine.objet || ref}</h1>
                            <ul className="doctrine-detail__meta">
                                <li><Calendar size={15} /> {formatDoctrineDate(doctrine.date, doctrine.reference_complete)}</li>
                                <li><FileText size={15} /> {ref}</li>
                                <li><Building size={15} /> {doctrine.service_emetteur || 'DGID'}</li>
                                {doctrine.destinataire && <li><strong>Destinataire :</strong>&nbsp;{doctrine.destinataire}</li>}
                                {doctrine.signataire && <li><strong>Signataire :</strong>&nbsp;{doctrine.signataire}</li>}
                            </ul>
                        </header>

                        {/* Actions du document */}
                        <div className="doctrine-detail__actions">
                            <ActionButton
                                variant="secondary"
                                icon={<Copy size={16} />}
                                onClick={() => { navigator.clipboard.writeText(ref); alert('Référence copiée : ' + ref); }}
                            >
                                Copier la référence
                            </ActionButton>
                            <ActionButton
                                variant="ghost"
                                icon={<AlertCircle size={16} />}
                                onClick={() => setIsReportModalOpen(true)}
                            >
                                Signaler une erreur
                            </ActionButton>
                        </div>

                        <div className="doctrine-detail__body">
                            {canRead ? (
                                loadingBody || body === null ? (
                                    <div className="doctrine-loading" style={{ padding: '2rem' }}>
                                        <Loader2 size={24} className="spinner" />
                                        <p>Chargement du texte…</p>
                                    </div>
                                ) : body ? (
                                    paragraphs.map((p, idx) => (p ? <p key={idx}>{p}</p> : <br key={idx} />))
                                ) : (
                                    <p className="doctrine-detail__novel">Texte intégral indisponible pour ce document.</p>
                                )
                            ) : (
                                <div className="doctrine-detail__gate">
                                    <div className="doctrine-detail__gate-icon"><Lock size={28} /></div>
                                    <h2>Texte intégral réservé aux membres</h2>
                                    <p>
                                        Créez un <strong>compte gratuit</strong> pour lire l'intégralité de cette lettre
                                        de doctrine fiscale. L'objet et les références restent en accès libre.
                                    </p>
                                    <button className="doctrine-detail__cta" onClick={() => setShowModal(true)}>
                                        Lire le texte intégral
                                    </button>
                                </div>
                            )}
                        </div>
                    </article>
                )}
            </div>

            <ConversionModal isOpen={showModal} onClose={() => setShowModal(false)} />
            {doctrine && (
                <ReportErrorModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    entityType="doctrine"
                    entityId={doctrine.id}
                    url={window.location.href}
                />
            )}
        </div>
    );
};

export default DoctrineDetailPage;
