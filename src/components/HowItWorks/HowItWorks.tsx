
import React from 'react';
import './HowItWorks.css';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: string;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Créez votre compte',
    description: 'Inscription gratuite en quelques secondes. Aucune carte bancaire requise.',
    icon: '👤'
  },
  {
    number: '02',
    title: 'Effectuez votre recherche',
    description: 'Utilisez notre moteur intelligent pour trouver les textes dont vous avez besoin.',
    icon: '🔍'
  },
  {
    number: '03',
    title: 'Analysez et exportez',
    description: 'Consultez les documents, annotez-les et exportez-les dans le format de votre choix.',
    icon: '📄'
  },
  {
    number: '04',
    title: 'Restez informé',
    description: 'Configurez vos alertes pour être notifié des évolutions juridiques pertinentes.',
    icon: '🔔'
  }
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works">
      <div className="how-it-works__connector">
        <svg className="how-it-works__path" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path 
            d="M0,50 Q300,10 600,50 T1200,50" 
            stroke="url(#pathGradient)" 
            strokeWidth="2" 
            fill="none"
            strokeDasharray="8 4"
          />
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.3"/>
              <stop offset="50%" stopColor="var(--color-emerald)" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.3"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="container">
        <div className="how-it-works__header">
          <span className="how-it-works__label">Processus</span>
          <h2 className="how-it-works__title">
            Comment <span className="how-it-works__title-accent">ça marche</span> ?
          </h2>
          <p className="how-it-works__subtitle">
            Un parcours simple et intuitif pour accéder à l'information juridique
          </p>
        </div>

        <div className="how-it-works__steps">
          {steps.map((step, index) => (
            <div key={index} className="how-it-works__step">
              <div className="how-it-works__step-number">
                <span>{step.number}</span>
              </div>
              <div className="how-it-works__step-icon">
                <span>{step.icon}</span>
              </div>
              <h3 className="how-it-works__step-title">{step.title}</h3>
              <p className="how-it-works__step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
