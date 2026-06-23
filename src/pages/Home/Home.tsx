import React from 'react';
import Hero from '../../components/Hero/Hero';
import ScrollReveal from '../../components/ScrollReveal/ScrollReveal';
import PiliersAccess from '../../components/Piliers/PiliersAccess';
import RecentlyPublished from '../../components/RecentlyPublished/RecentlyPublished';
import Manifeste from '../../components/Manifeste/Manifeste';
import Testimonials from '../../components/Testimonials/Testimonials';
import Impact from '../../components/Impact/Impact';
import SecurityStandards from '../../components/Trust/SecurityStandards';
import FreeAccountCTA from '../../components/FreeAccountCTA/FreeAccountCTA';

/**
 * Page d'accueil — Lot 5 (acquisition-first, SEO de hub)
 *
 * Structure :
 * 1. Hero — signature « Mémoire » + carte Afrique→Sénégal + recherche
 * 2. ScrollReveal — démo produit (2 piliers, holographique)
 * 3. PiliersAccess (A) — accès aux 4 piliers (maillage SEO)
 * 4. RecentlyPublished (B) — fraîcheur (codes/textes récents)
 * 5. Manifeste (C) — le récit « pas qu'un outil »
 * 6. Testimonials (D) — confiance des praticiens
 * 7. Impact — chiffres
 * 8. SecurityStandards — corpus vérifié / données
 * 9. FreeAccountCTA (E) — créer un compte gratuit
 */
const Home: React.FC = () => {
    return (
        <main>
            <Hero />
            <ScrollReveal />
            <PiliersAccess />
            <RecentlyPublished />
            <Manifeste />
            <Testimonials />
            <Impact />
            <SecurityStandards />
            <FreeAccountCTA />
        </main>
    );
};

export default Home;
