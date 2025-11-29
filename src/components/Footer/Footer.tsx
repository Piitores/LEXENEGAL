
import React from 'react';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { label: 'Fonctionnalités', href: '#features' },
      { label: 'Jurisprudence', href: '#jurisprudence' },
      { label: 'Législation', href: '#legislation' },
      { label: 'Veille', href: '#veille' },
    ],
    resources: [
      { label: 'Aide', href: '#' },
      { label: 'Guides', href: '#' },
      { label: 'FAQ', href: '#' },
    ],
    legal: [
      { label: 'Mentions légales', href: '#' },
      { label: 'Confidentialité', href: '#' },
      { label: 'CGU', href: '#' },
    ],
    contact: [
      { label: 'Support', href: '#' },
      { label: 'Partenariats', href: '#' },
      { label: 'contact@lexenegal.fr', href: 'mailto:contact@lexenegal.fr' },
    ],
  };

  return (
    <footer id="footer" className="footer">
      <div className="footer__top">
        <div className="container">
          <div className="footer__grid">
            <div className="footer__brand">
              <a href="#" className="footer__logo">
                LEXENEGAL
              </a>
              <p className="footer__tagline">
                L'Accès au Droit pour Tous.
                <br />
                La plateforme numérique de référence pour la justice au Sénégal.
              </p>
            </div>

            <div className="footer__links-group">
              <h4 className="footer__links-title">Plateforme</h4>
              <ul className="footer__links">
                {footerLinks.product.map((link, i) => (
                  <li key={i}><a href={link.href}>{link.label}</a></li>
                ))}
              </ul>
            </div>

            <div className="footer__links-group">
              <h4 className="footer__links-title">Ressources</h4>
              <ul className="footer__links">
                {footerLinks.resources.map((link, i) => (
                  <li key={i}><a href={link.href}>{link.label}</a></li>
                ))}
              </ul>
            </div>

            <div className="footer__links-group">
              <h4 className="footer__links-title">Contact</h4>
              <ul className="footer__links">
                {footerLinks.contact.map((link, i) => (
                  <li key={i}><a href={link.href}>{link.label}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container">
          <div className="footer__bottom-content">
            <p className="footer__copyright">
              © {currentYear} LEXENEGAL. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
