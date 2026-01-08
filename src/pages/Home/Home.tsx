import React from 'react';
import Hero from '../../components/Hero/Hero';
import MemoireSection from '../../components/MemoireSection/MemoireSection';
import ArsenalSection from '../../components/ArsenalSection/ArsenalSection';
import SecurityStandards from '../../components/Trust/SecurityStandards';
import Ecosystem from '../../components/Ecosystem/Ecosystem';
import Manifeste from '../../components/Manifeste/Manifeste';
import Impact from '../../components/Impact/Impact';

/**
 * Landing Page Unique - Entonnoir de Conviction
 * 
 * Structure:
 * 1. Hero Authority - Recherche centrale
 * 2. MemoireSection - "La Mémoire Organisée" (ex-SolutionsPage)
 * 3. ArsenalSection - "L'Arsenal Pro" + CTA (ex-ProPage)
 * 4. SecurityStandards - Badges de confiance
 * 5. Ecosystem - Chambres juridictionnelles
 * 6. Manifeste - L'Équité par la Clarté
 * 7. Impact - Chiffres et témoignages
 */
const Home: React.FC = () => {
    return (
        <main>
            {/* 1. HERO AUTHORITY */}
            <Hero />

            {/* 2. LA MÉMOIRE ORGANISÉE - Storytelling IA */}
            <MemoireSection />

            {/* 3. L'ARSENAL PRO - Bento Grid + CTA Contact */}
            <ArsenalSection />

            {/* 4. SÉCURITÉ & CONFIANCE */}
            <SecurityStandards />

            {/* 5. ÉCOSYSTÈME JURIDICTIONNEL */}
            <Ecosystem />

            {/* 6. MANIFESTE - L'Équité par la Clarté */}
            <Manifeste />

            {/* 7. IMPACT */}
            <Impact />
        </main>
    );
};

export default Home;
