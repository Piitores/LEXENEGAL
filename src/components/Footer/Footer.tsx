import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__content">
          <div className="footer__brand">
            <h2 className="footer__logo">LEXENEGAL</h2>
            <p className="footer__desc">
              La mémoire juridique organisée du Sénégal. Codes, lois, jurisprudence
              et doctrine, réunis et vérifiés.
            </p>
          </div>

          <div className="footer__col">
            <h4>Explorer</h4>
            <Link to="/search">Jurisprudence</Link>
            <Link to="/codes">Codes &amp; lois</Link>
            <Link to="/doctrine-fiscale">Doctrine</Link>
          </div>
          <div className="footer__col">
            <h4>Compte</h4>
            <Link to="/signup">Créer un compte</Link>
            <Link to="/login">Se connecter</Link>
            <Link to="/cabinet">Mon Cabinet</Link>
          </div>
          <div className="footer__col">
            <h4>Contact</h4>
            <a href="mailto:contact@lexenegal.sn">contact@lexenegal.sn</a>
            <Link to="/developpeurs">API pour développeurs</Link>
            <span>Dakar, Sénégal</span>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {currentYear} LEXENEGAL. Tous droits réservés.</p>
          <p className="footer__signature">Source Certifiée : LEXENEGAL.SN</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
