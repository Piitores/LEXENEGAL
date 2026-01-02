import React from 'react';
import Hero from '../../components/Hero/Hero';
import MasterEdition from '../../components/MasterEdition/MasterEdition';
import SecurityStandards from '../../components/Trust/SecurityStandards';
import Innovation from '../../components/Innovation/Innovation';
import Ecosystem from '../../components/Ecosystem/Ecosystem';
import Teasers from '../../components/Teasers/Teasers';
import Manifeste from '../../components/Manifeste/Manifeste';
import Impact from '../../components/Impact/Impact';

const Home: React.FC = () => {
    return (
        <main>
            <Hero />
            <MasterEdition />
            <SecurityStandards />
            <Innovation />
            <Ecosystem />
            <Teasers />
            <Manifeste />
            <Impact />
        </main>
    );
};

export default Home;


