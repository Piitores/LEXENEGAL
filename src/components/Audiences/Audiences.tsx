
import React, { useState } from 'react';
import './Audiences.css';

interface Audience {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  color: 'gold' | 'emerald' | 'blue';
}

const audiences: Audience[] = [
  {
    id: 'magistrats',
    icon: '⚖️',
    title: 'Magistrats & Avocats',
    subtitle: 'Confiance & Fiabilité',
    description: 'Un outil de travail quotidien fiable et exhaustif pour les professionnels de la justice.',
    benefits: [
      'Jurisprudence consolidée et vérifiée',
      'Recherche par critères avancés',
      'Alertes sur les domaines suivis',
      'Annotations et favoris personnels'
    ],
    color: 'gold'
  },
  {
    id: 'etudiants',
    icon: '🎓',
    title: 'Étudiants & Chercheurs',
    subtitle: 'Accessibilité & Gratuité',
    description: 'Démocratiser l\'accès au savoir juridique pour former la prochaine génération.',
    benefits: [
      'Accès gratuit à toutes les ressources',
      'Interface pédagogique intuitive',
      'Export pour travaux académiques',
      'Parcours thématiques guidés'
    ],
    color: 'emerald'
  },
  {
    id: 'institutions',
    icon: '🏛️',
    title: 'Institutions & Entreprises',
    subtitle: 'Excellence & Innovation',
    description: 'Une veille juridique intelligente pour anticiper et s\'adapter aux évolutions.',
    benefits: [
      'API pour intégration système',
      'Tableaux de bord personnalisés',
      'Rapports d\'analyse automatisés',
      'Support technique dédié'
    ],
    color: 'blue'
  }
];

function Audiences() {
  const [activeId, setActiveId] = useState<string>('magistrats');
  const activeAudience = audiences.find(a => a.id === activeId);

  return (
    <section id="audiences" className="audiences">
      <div className="audiences__pattern">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="audiences__pattern-diamond" style={{
            '--delay': `${i * 0.5}s`,
            '--x': `${10 + i * 15}%`,
            '--y': `${20 + (i % 3) * 30}%`
          } as React.CSSProperties}></div>
        ))}
      </div>

      <div className="container">
        <div className="audiences__header">
          <span className="audiences__label">Utilisateurs</span>
          <h2 className="audiences__title">
            Conçu pour <span className="audiences__title-accent">tous</span> les acteurs<br />
            du monde juridique
          </h2>
        </div>

        <div className="audiences__tabs">
          {audiences.map((audience) => (
            <button
              key={audience.id}
              className={`audiences__tab audiences__tab--${audience.color} ${activeId === audience.id ? 'audiences__tab--active' : ''}`}
              onClick={() => setActiveId(audience.id)}
            >
              <span className="audiences__tab-icon">{audience.icon}</span>
              <span className="audiences__tab-title">{audience.title}</span>
            </button>
          ))}
        </div>

        {activeAudience && (
          <div className={`audiences__content audiences__content--${activeAudience.color}`}>
            <div className="audiences__content-main">
              <span className="audiences__content-subtitle">{activeAudience.subtitle}</span>
              <h3 className="audiences__content-title">{activeAudience.title}</h3>
              <p className="audiences__content-description">{activeAudience.description}</p>
              
              <ul className="audiences__benefits">
                {activeAudience.benefits.map((benefit, index) => (
                  <li key={index} className="audiences__benefit">
                    <span className="audiences__benefit-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <a href="#access" className={`audiences__cta audiences__cta--${activeAudience.color}`}>
                Commencer gratuitement
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>

            <div className="audiences__content-visual">
              <div className="audiences__icon-large">
                <span>{activeAudience.icon}</span>
              </div>
              <div className="audiences__visual-ring audiences__visual-ring--1"></div>
              <div className="audiences__visual-ring audiences__visual-ring--2"></div>
              <div className="audiences__visual-ring audiences__visual-ring--3"></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Audiences;
