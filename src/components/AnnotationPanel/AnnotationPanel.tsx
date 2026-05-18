import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import './AnnotationPanel.css';

interface Annotation {
    id?: string;
    section_type: 'general' | 'faits' | 'motifs' | 'dispositif';
    content: string;
}

interface AnnotationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    decisionId: string;
    existingAnnotations: Annotation[];
    onSave: (annotation: Annotation) => Promise<void>;
}

const SECTION_TYPES = [
    { id: 'general', label: 'Général', color: 'badge-general' },
    { id: 'faits', label: 'Faits', color: 'badge-faits' },
    { id: 'motifs', label: 'Motifs', color: 'badge-motifs' },
    { id: 'dispositif', label: 'Dispositif', color: 'badge-dispositif' }
];

const AnnotationPanel: React.FC<AnnotationPanelProps> = ({
    isOpen,
    onClose,
    decisionId,
    existingAnnotations,
    onSave
}) => {
    const [activeSection, setActiveSection] = useState<'general' | 'faits' | 'motifs' | 'dispositif'>('general');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Sync content when section changes or when existing annotations are loaded
    useEffect(() => {
        const existing = existingAnnotations.find(a => a.section_type === activeSection);
        setContent(existing ? existing.content : '');
        setSaveSuccess(false);
    }, [activeSection, existingAnnotations, isOpen]);

    const handleSave = async () => {
        if (!content.trim() && !existingAnnotations.find(a => a.section_type === activeSection)) {
            return; // Don't save empty if it never existed
        }

        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await onSave({
                section_type: activeSection,
                content: content.trim()
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error saving annotation:', error);
            alert("Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="annotation-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Sliding Panel */}
                    <motion.div
                        className="annotation-panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="panel-header">
                            <div className="panel-title">
                                <FileText size={20} />
                                <h3>Mes Annotations</h3>
                            </div>
                            <button className="panel-close" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="panel-content">
                            <p className="panel-description">
                                Vos notes sont strictement privées. Elles apparaîtront dans votre espace Mon Cabinet.
                            </p>

                            {/* Section Selector */}
                            <div className="section-selector">
                                {SECTION_TYPES.map(section => (
                                    <button
                                        key={section.id}
                                        className={`section-btn ${activeSection === section.id ? 'active' : ''}`}
                                        onClick={() => setActiveSection(section.id as any)}
                                    >
                                        {section.label}
                                        {existingAnnotations.some(a => a.section_type === section.id && a.content) && (
                                            <span className="has-content-dot" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Editor */}
                            <div className="editor-container">
                                <textarea
                                    className="annotation-textarea"
                                    placeholder={`Rédigez votre note concernant les ${activeSection}...`}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                />
                            </div>

                            {/* Actions */}
                            <div className="panel-actions">
                                <button
                                    className={`btn-save ${saveSuccess ? 'success' : ''}`}
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <><Loader2 size={16} className="spin" /> Sauvegarde...</>
                                    ) : saveSuccess ? (
                                        <><CheckCircle2 size={16} /> Sauvegardé</>
                                    ) : (
                                        <><Save size={16} /> Enregistrer la note</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default AnnotationPanel;
