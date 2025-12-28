import React from 'react';
import Hero from '../../components/Hero/Hero';
import SecurityStandards from '../../components/Trust/SecurityStandards';
import Innovation from '../../components/Innovation/Innovation';
import Ecosystem from '../../components/Ecosystem/Ecosystem';
import Impact from '../../components/Impact/Impact';

const Home: React.FC = () => {
    return (
        <main>
            <Hero />
            <SecurityStandards />
            <Innovation />
            <Ecosystem />
            <Impact />
        </main>
    );
};

export default Home;
