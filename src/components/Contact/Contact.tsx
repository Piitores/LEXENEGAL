import React, { useState } from 'react';
import './Contact.css';

function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would typically handle the form submission, e.g., sending data to an API or Formspree
        console.log('Form submitted:', formData);
        alert('Merci de votre intérêt ! Nous vous recontacterons bientôt.');
        setFormData({ name: '', email: '', subject: '', message: '' });
    };

    return (
        <section id="contact" className="contact">
            <div className="contact__container container">
                <div className="contact__header">
                    <h2 className="contact__title">Contactez-nous</h2>
                    <p className="contact__subtitle">
                        Vous avez des questions ou souhaitez en savoir plus sur LEXENEGAL ?
                        Remplissez le formulaire ci-dessous et notre équipe vous répondra dans les plus brefs délais.
                    </p>
                </div>

                <div className="contact__content">
                    <form className="contact__form" onSubmit={handleSubmit}>
                        <div className="contact__form-group">
                            <label htmlFor="name" className="contact__label">Nom complet</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                className="contact__input"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Votre nom"
                            />
                        </div>

                        <div className="contact__form-group">
                            <label htmlFor="email" className="contact__label">Adresse email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="contact__input"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="votre@email.com"
                            />
                        </div>

                        <div className="contact__form-group">
                            <label htmlFor="subject" className="contact__label">Sujet</label>
                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                className="contact__input"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                                placeholder="Sujet de votre message"
                            />
                        </div>

                        <div className="contact__form-group">
                            <label htmlFor="message" className="contact__label">Message</label>
                            <textarea
                                id="message"
                                name="message"
                                className="contact__textarea"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                placeholder="Votre message..."
                                rows={5}
                            ></textarea>
                        </div>

                        <button type="submit" className="contact__button">
                            Envoyer le message
                        </button>
                    </form>

                    <div className="contact__info">
                        <div className="contact__info-item">
                            <span className="contact__info-icon">📧</span>
                            <div>
                                <h3 className="contact__info-title">Email</h3>
                                <a href="mailto:contact@lexenegal.fr" className="contact__info-link">contact@lexenegal.fr</a>
                            </div>
                        </div>
                        <div className="contact__info-item">
                            <span className="contact__info-icon">📍</span>
                            <div>
                                <h3 className="contact__info-title">Adresse</h3>
                                <p className="contact__info-text">Dakar, Sénégal</p>
                            </div>
                        </div>
                        <div className="contact__card-decoration"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Contact;
