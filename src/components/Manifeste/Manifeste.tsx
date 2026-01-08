import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import './Manifeste.css';

const Manifeste: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.3 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.08
            }
        }
    };

    const wordVariants = {
        hidden: { opacity: 0, y: 8 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.3, ease: "easeOut" }
        }
    };

    const renderWords = (text: string) => {
        return text.split(' ').map((word, i) => (
            <motion.span key={i} variants={wordVariants} style={{ display: 'inline-block', marginRight: '0.3em' }}>
                {word}
            </motion.span>
        ));
    };

    return (
        <section ref={sectionRef} className="manifeste">
            <div className="container">
                <motion.div
                    className="manifeste__divider"
                    initial={{ width: 0 }}
                    animate={isVisible ? { width: 60 } : {}}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />

                <motion.h3
                    className="manifeste__tagline"
                    initial={{ opacity: 0, y: 20 }}
                    animate={isVisible ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    L'Équité par la Clarté
                </motion.h3>

                <blockquote className="manifeste__text">
                    <motion.p
                        className="manifeste__paragraph"
                        variants={containerVariants}
                        initial="hidden"
                        animate={isVisible ? "visible" : "hidden"}
                    >
                        {renderWords("Au carrefour de la tradition juridique et de l'innovation, nous croyons que le droit ne doit plus être une matière opaque. Notre mission est de restaurer la clarté là où régnait la complexité.")}
                    </motion.p>

                    <motion.p
                        className="manifeste__paragraph"
                        variants={containerVariants}
                        initial="hidden"
                        animate={isVisible ? "visible" : "hidden"}
                        transition={{ delayChildren: 2 }}
                    >
                        {renderWords("En éditant chaque décision avec la précision due aux grands arrêts, nous offrons aux acteurs du droit sénégalais — magistrats, avocats et citoyens — un instrument de vérité.")}
                    </motion.p>

                    <motion.p
                        className="manifeste__paragraph manifeste__paragraph--strong"
                        variants={containerVariants}
                        initial="hidden"
                        animate={isVisible ? "visible" : "hidden"}
                        transition={{ delayChildren: 4 }}
                    >
                        {renderWords("Lexenegal n'est pas seulement une base de données ; c'est l'engagement d'une justice accessible, documentée et technologiquement souveraine.")}
                    </motion.p>
                </blockquote>

                <motion.div
                    className="manifeste__signature"
                    initial={{ opacity: 0 }}
                    animate={isVisible ? { opacity: 1 } : {}}
                    transition={{ duration: 0.6, delay: 6 }}
                >
                    — Le Manifeste Lexenegal
                </motion.div>
            </div>
        </section>
    );
};

export default Manifeste;
