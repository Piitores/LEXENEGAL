import { describe, it, expect } from 'vitest';
import { traduireErreurAuth, estEmailNonConfirme } from '../authErrors';

describe('traduireErreurAuth', () => {
  it('règle « lettres et chiffres » (groupes fusionnés)', () => {
    const msg = 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.';
    expect(traduireErreurAuth({ message: msg })).toBe(
      'Le mot de passe doit contenir au moins une lettre et un chiffre.'
    );
  });

  it('règle « minuscules, majuscules, chiffres, symboles »', () => {
    const msg = "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};':\"|<>?,./`~.";
    expect(traduireErreurAuth({ message: msg })).toBe(
      'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un symbole.'
    );
  });

  it('longueur minimale', () => {
    expect(traduireErreurAuth({ message: 'Password should be at least 8 characters.' })).toBe(
      'Le mot de passe doit contenir au moins 8 caractères.'
    );
  });

  it('mot de passe compromis', () => {
    expect(traduireErreurAuth({ message: 'Password is known to be weak and easy to guess, please choose a different one.' })).toBe(
      'Ce mot de passe est trop courant ou a déjà fuité. Choisissez-en un autre.'
    );
  });

  it('identifiants invalides', () => {
    expect(traduireErreurAuth({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe(
      'E-mail ou mot de passe incorrect.'
    );
  });

  it('compte déjà existant', () => {
    expect(traduireErreurAuth({ message: 'User already registered' })).toBe(
      'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».'
    );
  });

  it('limite d\'envoi avec délai', () => {
    expect(traduireErreurAuth({ message: 'For security purposes, you can only request this after 47 seconds.', code: 'over_email_send_rate_limit' })).toBe(
      'Merci de patienter 47 secondes avant de redemander un e-mail.'
    );
  });

  it('limite d\'envoi globale', () => {
    expect(traduireErreurAuth({ message: 'Email rate limit exceeded' })).toBe(
      "Trop d'e-mails envoyés pour le moment. Réessayez dans quelques minutes."
    );
  });

  it('message inconnu : conservé tel quel', () => {
    expect(traduireErreurAuth({ message: 'Something odd' })).toBe('Something odd');
  });

  it('erreur vide : message générique', () => {
    expect(traduireErreurAuth(null)).toBe('Une erreur est survenue. Réessayez.');
  });
});

describe('estEmailNonConfirme', () => {
  it('reconnaît le code Supabase', () => {
    expect(estEmailNonConfirme({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toBe(true);
  });
  it('reconnaît le message seul', () => {
    expect(estEmailNonConfirme({ message: 'Email not confirmed' })).toBe(true);
  });
  it('rejette les autres erreurs', () => {
    expect(estEmailNonConfirme({ message: 'Invalid login credentials' })).toBe(false);
    expect(estEmailNonConfirme(null)).toBe(false);
  });
});
