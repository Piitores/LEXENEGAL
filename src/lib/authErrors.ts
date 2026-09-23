/**
 * Traduction en français des erreurs renvoyées par Supabase Auth.
 * Supabase parle anglais et ses messages sont techniques ; l'utilisateur
 * doit comprendre quoi corriger sans deviner.
 */

export interface ErreurAuth {
    message?: string;
    code?: string;
}

const GENERIQUE = 'Une erreur est survenue. Réessayez.';

/** Vrai si la connexion a été refusée parce que l'e-mail n'est pas encore vérifié. */
export function estEmailNonConfirme(err: ErreurAuth | null | undefined): boolean {
    if (!err) return false;
    if (err.code === 'email_not_confirmed') return true;
    return /email not confirmed/i.test(err.message || '');
}

/** Décrit en français les classes de caractères exigées par la règle de mot de passe. */
function decrireRegleMotDePasse(message: string): string {
    // Le message liste les groupes exigés, séparés par « , ». Un groupe qui contient
    // à la fois minuscules et majuscules signifie « lettres » (règle « lettres et chiffres »).
    const groupes = message.split(':').slice(1).join(':').split(', ');
    const parts: string[] = [];
    let lettres = false, minuscule = false, majuscule = false;
    for (const g of groupes) {
        const hasLower = g.includes('abcdefghijklmnopqrstuvwxyz');
        const hasUpper = g.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        if (hasLower && hasUpper) lettres = true;
        else if (hasLower) minuscule = true;
        else if (hasUpper) majuscule = true;
    }
    if (lettres) parts.push('une lettre');
    if (minuscule) parts.push('une minuscule');
    if (majuscule) parts.push('une majuscule');
    if (message.includes('0123456789')) parts.push('un chiffre');
    if (message.includes('!@#')) parts.push('un symbole');
    if (parts.length === 0) return 'Le mot de passe ne respecte pas les règles de sécurité.';
    const liste = parts.length === 1
        ? parts[0]
        : parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1];
    return `Le mot de passe doit contenir au moins ${liste}.`;
}

export function traduireErreurAuth(err: ErreurAuth | null | undefined): string {
    const message = err?.message?.trim();
    if (!message) return GENERIQUE;

    if (/should contain at least one character of each/i.test(message)) {
        return decrireRegleMotDePasse(message);
    }
    const longueur = message.match(/should be at least (\d+) characters/i);
    if (longueur) return `Le mot de passe doit contenir au moins ${longueur[1]} caractères.`;

    if (/known to be weak|easy to guess|pwned/i.test(message)) {
        return 'Ce mot de passe est trop courant ou a déjà fuité. Choisissez-en un autre.';
    }
    if (err?.code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
        return 'E-mail ou mot de passe incorrect.';
    }
    if (/already registered|already been registered/i.test(message)) {
        return 'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».';
    }
    const delai = message.match(/only request this after (\d+) seconds/i);
    if (delai) return `Merci de patienter ${delai[1]} secondes avant de redemander un e-mail.`;
    if (/rate limit exceeded/i.test(message)) {
        return "Trop d'e-mails envoyés pour le moment. Réessayez dans quelques minutes.";
    }
    if (estEmailNonConfirme(err)) {
        return "Votre adresse e-mail n'a pas encore été vérifiée.";
    }
    if (/token has expired or is invalid|otp_expired/i.test(message) || err?.code === 'otp_expired') {
        return 'Code invalide ou expiré. Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.';
    }
    if (/unable to validate email|invalid email/i.test(message)) {
        return "L'adresse e-mail n'est pas valide.";
    }
    return message;
}
