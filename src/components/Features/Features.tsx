
import React from 'react';
import './Features.css';

function Features() {
  const features = [
    {
      title: 'Jurisprudence',
      icon: '⚖️',
      description: 'Accédez à l\'ensemble des décisions de justice des cours et tribunaux du Sénégal.',
      link: '#contact'
    },
    {
      title: 'Législation',
      icon: '📜',
      description: 'Consultez les codes, lois, décrets et arrêtés officiels mis à jour en temps réel.',
      link: '#contact'
    },
    {
      title: 'Veille Juridique',
      icon: '🔔',
      description: 'Restez informé des dernières actualités et évolutions du droit sénégalais.',
      link: '#contact'
    }
  ];

  const handleFeatureClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const contactSection = document.getElementById('contact');
    contactSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="features" id="features">
      <div className="features__container container">
        <div className="features__grid">
          {features.map((feature, index) => (
            <div key={index} className="features__card">
              <div className="features__icon">{feature.icon}</div>
              <h3 className="features__title">{feature.title}</h3>
              <p className="features__description">{feature.description}</p>
              <a href={feature.link} className="features__link" onClick={handleFeatureClick}>Bientôt disponible &rarr;</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
