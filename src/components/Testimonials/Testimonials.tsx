import React from 'react';
import { ScrollReelTestimonials, ScrollReelTestimonial } from './ScrollReelTestimonials';
import './Testimonials.css';

const TESTIMONIALS: ScrollReelTestimonial[] = [
    {
        quote: "Le Code général des impôts sénégalais annoté, avec les renvois directs vers la doctrine fiscale, me fait gagner un temps précieux : je vérifie une disposition et j'ai aussitôt les commentaires et les sources sous les yeux.",
        name: 'Pape Moussa Gaye',
        role: 'Senior Associate, Mansa-Tax & Legal',
        initials: 'PMG',
    },
    {
        quote: "Au greffe, je dois retrouver vite une décision ou un texte exact. La jurisprudence et les textes sénégalais y sont fiables et à jour, et la copie de citation me simplifie le quotidien.",
        name: 'Mor Talla Fall',
        role: 'Greffier',
        initials: 'MTF',
    },
    {
        quote: "Avoir la jurisprudence sénégalaise et les codes consolidés du Sénégal, réunis et vérifiés au même endroit, est un vrai appui pour préparer mes décisions. La rigueur des sources fait la différence.",
        name: 'Yegoul Thione',
        role: 'Magistrat',
        initials: 'YT',
    },
    {
        quote: "Pour mes recherches en droit sénégalais, l'étendue du corpus et la recherche fédérée sur la jurisprudence, les codes et la doctrine du Sénégal sont précieuses. Un outil sérieux et fiable.",
        name: 'Aissatou Diop',
        role: 'Doctorante chercheuse, Laboratoire de droit, UCAD',
        initials: 'AD',
    },
    {
        quote: "Avec Lexenegal, préparer mes fiches de travaux dirigés en droit sénégalais est plus simple : je donne à mes étudiants des références qu'ils retrouvent sans aucune difficulté.",
        name: 'Alioune Badara Cissé',
        role: 'Enseignant-chercheur',
        initials: 'AC',
    },
    {
        quote: "Le Code de l'environnement du Sénégal, consolidé et à jour avec son décret d'application, est exactement ce qu'il me faut. Je retrouve une disposition et son texte d'application en quelques secondes.",
        name: 'Moustapha Fall',
        role: 'Consultant en droit de l\'environnement',
        initials: 'MF',
    },
    {
        quote: "Étudiante en droit à l'UGB de Saint-Louis, j'accède enfin gratuitement à des textes sénégalais fiables et bien organisés. Je trouve l'article, je comprends sa place dans le code, et je peux le citer correctement.",
        name: 'Oulimata Traoré',
        role: 'Étudiante en droit, UGB Saint-Louis',
        initials: 'OT',
    },
];

const Testimonials: React.FC = () => (
    <section id="temoignages" className="testimonials">
        <div className="container">
            <header className="testimonials__header">
                <span className="testimonials__badge">Ils utilisent Lexenegal</span>
                <h2 className="testimonials__title">
                    La confiance des <span className="text-gradient">praticiens du droit sénégalais</span>
                </h2>
                <p className="testimonials__subtitle">
                    Avocats, magistrats, greffiers, chercheurs et étudiants du Sénégal s'appuient au
                    quotidien sur la mémoire juridique organisée du droit sénégalais.
                </p>
            </header>

            <ScrollReelTestimonials testimonials={TESTIMONIALS} />
        </div>
    </section>
);

export default Testimonials;
