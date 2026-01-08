import React, { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Scan, Layers, Shield, Sparkles } from 'lucide-react';
import './MemoireSection.css';

const MemoireSection: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start 0.8", "end 0.5"]
    });

    const spineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.15 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const cardVariants = {
        hidden: (i: number) => ({
            opacity: 0,
            x: i % 2 === 0 ? -80 : 80,
            y: 40,
            rotateY: i % 2 === 0 ? -10 : 10
        }),
        visible: (i: number) => ({
            opacity: 1,
            x: 0,
            y: 0,
            rotateY: 0,
            transition: {
                duration: 0.8,
                delay: i * 0.2,
                ease: [0.25, 0.46, 0.45, 0.94] as const
            }
        })
    };

    const iconVariants = {
        initial: { scale: 1, rotate: 0 },
        animate: {
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
            transition: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut" as const
            }
        }
    };

    const floatingOrb = {
        animate: {
            y: [-10, 10, -10],
            scale: [1, 1.05, 1],
            transition: {
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut" as const
            }
        }
    };

    return (
        <section ref={sectionRef} id="memoire" className={`memoire-section ${isVisible ? 'visible' : ''}`}>
            {/* Floating Background Orbs */}
            <motion.div
                className="memoire__orb memoire__orb--1"
                animate={floatingOrb.animate}
            />
            <motion.div
                className="memoire__orb memoire__orb--2"
                animate={{
                    ...floatingOrb.animate,
                    transition: { ...floatingOrb.animate.transition, delay: 2 }
                }}
            />
            <motion.div
                className="memoire__orb memoire__orb--3"
                animate={{
                    ...floatingOrb.animate,
                    transition: { ...floatingOrb.animate.transition, delay: 4 }
                }}
            />

            <div className="memoire__container">
                {/* Header with staggered animation */}
                <motion.header
                    className="memoire__header"
                    initial={{ opacity: 0, y: 50 }}
                    animate={isVisible ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <motion.span
                        className="memoire__badge"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={isVisible ? { scale: 1, rotate: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
                    >
                        <Sparkles size={14} />
                        L'Ingénierie
                    </motion.span>
                    <h2 className="memoire__title">La Mémoire Organisée</h2>
                    <p className="memoire__subtitle">Comment nous transformons le chaos documentaire en savoir exploitable.</p>
                </motion.header>

                {/* Scroll-based Spine + Blocks Container */}
                <div className="memoire__blocks-wrapper">
                    {/* Vertical Spine - Scroll-based Animation */}
                    <motion.div
                        className="memoire__spine-line"
                        style={{ height: spineHeight }}
                    />

                    {/* Cards with 3D entrance */}
                    <div className="memoire__blocks">
                        {/* Card 1: La Capturation */}
                        <motion.div
                            className="memoire__block"
                            custom={0}
                            initial="hidden"
                            animate={isVisible ? "visible" : "hidden"}
                            variants={cardVariants}
                        >
                            <div className="memoire__content">
                                <span className="memoire__step">1</span>
                                <motion.div
                                    className="memoire__icon"
                                    variants={iconVariants}
                                    initial="initial"
                                    animate="animate"
                                >
                                    <Scan size={32} strokeWidth={1.5} />
                                </motion.div>
                                <h3>La Capturation</h3>
                                <span className="memoire__label">Extraction Intelligente</span>

                                <div className="memoire__demo memoire__demo--capturation">
                                    <motion.div
                                        className="demo-before"
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className="blur-text">ARRÊT N° 04 CS DU 17 SEPTEMBRE 2008 CONTRAT DE TRAVAIL – RUPTURE...</div>
                                        <div className="scan-line"></div>
                                    </motion.div>
                                    <motion.div
                                        className="demo-after"
                                        whileHover={{ scale: 1.02, borderColor: '#047857' }}
                                    >
                                        <div className="clear-text">
                                            <strong>Arrêt n° 04</strong><br />
                                            Cour Suprême — 17 sept. 2008
                                        </div>
                                    </motion.div>
                                </div>

                                <p>Notre IA scanne les bulletins multi-arrêts et isole chaque décision avec une précision chirurgicale.</p>
                            </div>
                            <div className="memoire__visual">
                                <div className="visual-glow visual-glow--green"></div>
                            </div>
                        </motion.div>

                        {/* Card 2: L'Architecture */}
                        <motion.div
                            className="memoire__block"
                            custom={1}
                            initial="hidden"
                            animate={isVisible ? "visible" : "hidden"}
                            variants={cardVariants}
                        >
                            <div className="memoire__content">
                                <span className="memoire__step">2</span>
                                <motion.div
                                    className="memoire__icon"
                                    variants={iconVariants}
                                    initial="initial"
                                    animate="animate"
                                >
                                    <Layers size={32} strokeWidth={1.5} />
                                </motion.div>
                                <h3>L'Architecture</h3>
                                <span className="memoire__label">Segmentation & Chambres</span>

                                <div className="memoire__demo memoire__demo--architecture">
                                    {['faits', 'motifs', 'dispositif'].map((type, i) => (
                                        <motion.div
                                            key={type}
                                            className={`arch-block arch-block--${type}`}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={isVisible ? { opacity: 1, x: 0 } : {}}
                                            transition={{ delay: 0.8 + i * 0.15 }}
                                            whileHover={{ x: 8, backgroundColor: '#F9FAFB' }}
                                        >
                                            <span>{type.toUpperCase()}</span>
                                            <p>{type === 'faits' ? 'Le demandeur a été licencié...' :
                                                type === 'motifs' ? 'Attendu que l\'article 52...' :
                                                    'PAR CES MOTIFS, casse...'}</p>
                                        </motion.div>
                                    ))}
                                </div>

                                <p className="chambre-label">2ème Chambre Civile et Commerciale</p>
                            </div>
                            <div className="memoire__visual">
                                <div className="visual-glow visual-glow--amber"></div>
                            </div>
                        </motion.div>

                        {/* Card 3: La Souveraineté */}
                        <motion.div
                            className="memoire__block"
                            custom={2}
                            initial="hidden"
                            animate={isVisible ? "visible" : "hidden"}
                            variants={cardVariants}
                        >
                            <div className="memoire__content">
                                <span className="memoire__step">3</span>
                                <motion.div
                                    className="memoire__icon"
                                    variants={iconVariants}
                                    initial="initial"
                                    animate="animate"
                                >
                                    <Shield size={32} strokeWidth={1.5} />
                                </motion.div>
                                <h3>La Souveraineté</h3>
                                <span className="memoire__label">Pseudonymisation</span>

                                <motion.div
                                    className="memoire__demo memoire__demo--sovereignty"
                                    initial={{ opacity: 0 }}
                                    animate={isVisible ? { opacity: 1 } : {}}
                                    transition={{ delay: 1.2 }}
                                >
                                    <motion.div
                                        className="sov-before"
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <span className="redacted">Mamadou Sow</span> c/ <span className="redacted">Aminata Ba</span>
                                    </motion.div>
                                    <motion.div
                                        className="sov-arrow"
                                        animate={{ x: [0, 8, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    >
                                        →
                                    </motion.div>
                                    <motion.div
                                        className="sov-after"
                                        whileHover={{ scale: 1.05 }}
                                    >
                                        <span className="protected">M. S.</span> c/ <span className="protected">A. B.</span>
                                    </motion.div>
                                </motion.div>

                                <p>Protection des données conformément aux normes internationales. Les parties sont protégées, la justice reste accessible.</p>
                            </div>
                            <div className="memoire__visual">
                                <div className="visual-glow visual-glow--blue"></div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MemoireSection;
