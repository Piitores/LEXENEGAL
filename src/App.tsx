import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar/Navbar';
import Hero from './components/Hero/Hero';
import SecurityStandards from './components/Trust/SecurityStandards';
import Innovation from './components/Innovation/Innovation';
import Ecosystem from './components/Ecosystem/Ecosystem';
import Impact from './components/Impact/Impact';
import Footer from './components/Footer/Footer';
import './App.css';

function App() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app">
      <Navbar scrolled={scrolled} />
      <main>
        <Hero />
        <SecurityStandards />
        <Innovation />
        <Ecosystem />
        <Impact />
      </main>
      <Footer />
    </div>
  );
}

export default App;
