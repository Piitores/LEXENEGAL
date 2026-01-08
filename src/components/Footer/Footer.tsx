import React from 'react';
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
              L'excellence technologique au service de la transparence judiciaire.
            </p>
          </div>

          <div className="footer__col">
            <h4>Plateforme</h4>
            <a href="#">Jurisprudence</a>
            <a href="#">Législation</a>
            <a href="#">Tarifs</a>
          </div>
          <div className="footer__col">
            <h4>Légal</h4>
            <a href="#">CGU</a>
            <a href="#">Confidentialité</a>
            <a href="#">Mentions Légales</a>
          </div>
          <div className="footer__col">
            <h4>Contact</h4>
            <a href="mailto:contact@lexenegal.sn">contact@lexenegal.sn</a>
            <span>Dakar, Sénégal</span>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {currentYear} LEXENEGAL. Tous droits réservés.</p>
          <p className="footer__signature">Source Certifiée: LEXENEGAL.SN</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
