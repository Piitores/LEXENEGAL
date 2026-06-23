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
                    Pas seulement un outil
                </motion.h3>

                <blockquote className="manifeste__text">
                    <MagicParagraph
                        text="Pendant longtemps, le droit sénégalais est resté épars : des décisions dispersées, des textes difficiles d'accès, une mémoire fragmentée. Une règle n'a de valeur que si chacun peut la retrouver."
                        containerRef={sectionRef}
                        offsetStart="start 0.85"
                        offsetEnd="start 0.45"
                    />

                    <MagicParagraph
                        text="Lexenegal réunit, vérifie et organise cette mémoire : la jurisprudence et les textes du Sénégal, édités avec rigueur et reliés entre eux, pour les magistrats, les avocats, les étudiants et les citoyens."
                        containerRef={sectionRef}
                        offsetStart="start 0.55"
                        offsetEnd="start 0.15"
                    />

                    <MagicParagraph
                        text="Lexenegal n'est pas qu'un outil. C'est la mémoire juridique organisée du Sénégal, pour qu'aucune règle ne se perde."
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
                    Le Manifeste Lexenegal
                </motion.div>
            </div>
        </section>
    );
};

export default Manifeste;
