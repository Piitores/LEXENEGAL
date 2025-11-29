
import React from 'react';
import './Hero.css';
import heroImage from '../../assets/hero_baobab.png';

function Hero() {
  const scrollToContact = () => {
    const contactSection = document.getElementById('contact');
    contactSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero">
      <div className="hero__container container">
        <div className="hero__content">
          <h1 className="hero__headline">
            L'Accès au Droit <br />
            <span className="hero__headline--highlight">pour Tous</span>
          </h1>
          <p className="hero__subheadline">
            La plateforme numérique de référence pour la justice au Sénégal est en cours de construction.
            <br />
            <strong>Bientôt disponible.</strong> Rejoignez la liste d'attente pour être informé du lancement.
          </p>

          <div className="hero__cta-group">
            <button className="hero__cta-button" onClick={scrollToContact}>
              Rejoindre la liste d'attente
            </button>
            <button className="hero__cta-button hero__cta-button--outline" onClick={scrollToContact}>
              Nous contacter
            </button>
          </div>

          <div className="hero__tags">
            <span>Bientôt :</span>
            <span className="hero__tag">Jurisprudence</span>
            <span className="hero__tag">Législation</span>
            <span className="hero__tag">Veille Juridique</span>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__image-wrapper">
            <img src={heroImage} alt="Baobab numérique - LEXENEGAL" className="hero__image" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
