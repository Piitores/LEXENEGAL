import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './ReportErrorModal.css';


interface ReportErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: 'decision' | 'article' | 'system' | '404';
    entityId?: string;
    url: string;
}

const ReportErrorModal: React.FC<ReportErrorModalProps> = ({
    isOpen,
    onClose,
    entityType,
    entityId,
    url
}) => {
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!description.trim()) {
            setError('Veuillez décrire l\'erreur.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error: submitError } = await supabase
                .from('user_reports')
                .insert([
                    {
                        user_id: user?.id || null,
                        url: url,
                        entity_type: entityType,
                        entity_id: entityId || null,
                        description: description.trim(),
                        status: 'pending',
                        browser_info: {
                            userAgent: navigator.userAgent,
                            language: navigator.language,
                            screenSize: `${window.innerWidth}x${window.innerHeight}`
                        }
                    }
                ]);

            if (submitError) throw submitError;

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setTimeout(() => {
                    setSuccess(false);
                    setDescription('');
                }, 500); // Reset after modal is fully closed
            }, 2000);

        } catch (err: any) {
            console.error('Error submitting report:', err);
            setError('Une erreur est survenue lors de l\'envoi. Veuillez réessayer plus tard.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="report-modal-wrapper">
                    {/* MODAL */}
                    <motion.div
                            className="report-modal"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            {/* CLOSE BUTTON */}
                            <button className="modal-close" onClick={!isSubmitting ? onClose : undefined} disabled={isSubmitting}>
                                <X size={20} />
                            </button>

                            {success ? (
                                <div className="report-success">
                                    <div className="success-icon-wrapper">
                                        <Send size={48} className="success-icon" />
                                    </div>
                                    <h2 className="modal-title">Merci pour votre vigilance !</h2>
                                    <p className="modal-message">
                                        Votre signalement a été transmis à notre équipe d'experts.
                                        Il sera examiné et corrigé dans les plus brefs délais.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* HEADER */}
                                    <div className="report-header">
                                        <div className="report-icon-wrapper">
                                            <AlertTriangle size={24} className="report-icon" />
                                        </div>
                                        <h2 className="modal-title">Signaler une erreur</h2>
                                    </div>
                                    
                                    <p className="modal-message">
                                        Vous avez remarqué une coquille, une erreur de formatage ou un problème technique ? Décrivez-le ci-dessous.
                                    </p>

                                    <form onSubmit={handleSubmit} className="report-form">
                                        <textarea
                                            className="report-textarea"
                                            placeholder="Ex: Le paragraphe 3 est tronqué..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            disabled={isSubmitting}
                                            rows={5}
                                            autoFocus
                                        />
                                        
                                        {error && <div className="report-error-msg">{error}</div>}

                                        <div className="report-actions">
                                            <button 
                                                type="button" 
                                                className="report-btn-secondary"
                                                onClick={onClose}
                                                disabled={isSubmitting}
                                            >
                                                Annuler
                                            </button>
                                            <button 
                                                type="submit" 
                                                className="report-btn-primary"
                                                disabled={isSubmitting || !description.trim()}
                                            >
                                                {isSubmitting ? (
                                                    <><Loader2 size={18} className="spinner" /> Envoi...</>
                                                ) : (
                                                    <><Send size={18} /> Envoyer</>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ReportErrorModal;
