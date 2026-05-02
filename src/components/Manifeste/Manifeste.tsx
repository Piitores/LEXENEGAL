import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import './Manifeste.css';

/**
 * 🏛️ LEXENEGAL — MagicWord
 * Chaque mot s'illumine progressivement au scroll.
 * Version réécrite sans Tailwind, fidèle à la DA Lexenegal.
 */
interface MagicWordProps {
    children: string;
    progress: any;
    range: number[];
    isStrong?: boolean;
}

const MagicWord: React.FC<MagicWordProps> = ({ children, progress, range, isStrong }) => {
    const opacity = useTransform(progress, range, [0, 1]);

    return (
        <span className={`magic-word ${isStrong ? 'magic-word--strong' : ''}`}>
            <span className="magic-word__ghost">{children}</span>
            <motion.span className="magic-word__reveal" style={{ opacity }}>
                {children}
            </motion.span>
        </span>
    );
};

/**
 * MagicParagraph — Un paragraphe entier dont les mots se révèlent au scroll
 */
interface MagicParagraphProps {
    text: string;
    containerRef: React.RefObject<HTMLElement | null>;
    offsetStart: string;
    offsetEnd: string;
    isStrong?: boolean;
}

const MagicParagraph: React.FC<MagicParagraphProps> = ({
    text,
    containerRef,
    offsetStart,
    offsetEnd,
    isStrong,
}) => {
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: [offsetStart as any, offsetEnd as any],
    });

    const words = text.split(' ');

    return (
        <p className={`manifeste__paragraph manifeste__magic-p ${isStrong ? 'manifeste__paragraph--strong' : ''}`}>
            {words.map((word, i) => {
                const start = i / words.length;
                const end = start + 1 / words.length;
                return (
                    <MagicWord key={i} progress={scrollYProgress} range={[start, end]} isStrong={isStrong}>
                        {word}
                    </MagicWord>
                );
            })}
        </p>
    );
};

/**
 * 🏛️ MANIFESTE — L'Équité par la Clarté
 * Animation MagicText : chaque mot se révèle au scroll
 */
const Manifeste: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);

    return (
        <section ref={sectionRef} className="manifeste">
            <div className="container">
                <motion.div
                    className="manifeste__divider"
                    initial={{ width: 0 }}
                    whileInView={{ width: 60 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />

                <motion.h3
                    className="manifeste__tagline"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    L'Équité par la Clarté
                </motion.h3>

                <blockquote className="manifeste__text">
                    <MagicParagraph
                        text="Au carrefour de la tradition juridique et de l'innovation, nous croyons que le droit ne doit plus être une matière opaque. Notre mission est de restaurer la clarté là où régnait la complexité."
                        containerRef={sectionRef}
                        offsetStart="start 0.85"
                        offsetEnd="start 0.45"
                    />

                    <MagicParagraph
                        text="En éditant chaque décision avec la précision due aux grands arrêts, nous offrons aux acteurs du droit sénégalais — magistrats, avocats et citoyens — un instrument de vérité."
                        containerRef={sectionRef}
                        offsetStart="start 0.55"
                        offsetEnd="start 0.15"
                    />

                    <MagicParagraph
                        text="Lexenegal n'est pas seulement une base de données ; c'est l'engagement d'une justice accessible, documentée et technologiquement souveraine."
                        containerRef={sectionRef}
                        offsetStart="start 0.25"
                        offsetEnd="end 0.75"
                        isStrong
                    />
                </blockquote>

                <motion.div
                    className="manifeste__signature"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    — Le Manifeste Lexenegal
                </motion.div>
            </div>
        </section>
    );
};

export default Manifeste;
