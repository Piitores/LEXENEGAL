/**
 * Traduction en français des erreurs renvoyées par Supabase Auth.
 * Supabase parle anglais et ses messages sont techniques ; l'utilisateur
 * doit comprendre quoi corriger sans deviner.
 */
import { estDelaiDepasse } from './delaiRequetes';

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

/**
 * Requêtes d'authentification NON IDEMPOTENTES (lib/delaiRequetes.ts, borne de 120 s) : le serveur
 * envoie le courriel avant de répondre, et un code ne sert qu'une fois. Quand la réponse n'arrive pas
 * à temps, l'issue est INCERTAINE : le message ne doit jamais affirmer l'échec (un nouvel essai
 * recevrait « User already registered », un code déjà consommé, ou un second courriel).
 */
export type ActionAuthNonIdempotente = 'inscription' | 'verification' | 'lien' | 'reinitialisation' | 'renvoi';

const REPONSE_TARDIVE: Record<ActionAuthNonIdempotente, string> = {
    inscription: 'Le serveur a tardé à répondre : votre compte a peut-être été créé. Vérifiez votre boîte mail (un code de vérification a pu partir) ou essayez de vous connecter avant de recommencer.',
    verification: 'Le serveur a tardé à répondre : votre adresse a peut-être été vérifiée. Essayez de vous connecter ; si le code est refusé, cliquez sur « Renvoyer le code ».',
    lien: "Le serveur a tardé à répondre : le lien de connexion est peut-être parti. Vérifiez votre boîte mail (et les courriers indésirables) avant d'en redemander un.",
    reinitialisation: "Le serveur a tardé à répondre : l'e-mail de réinitialisation est peut-être parti. Vérifiez votre boîte mail (et les courriers indésirables) avant de recommencer.",
    renvoi: "Le serveur a tardé à répondre : un nouveau code est peut-être parti. Vérifiez votre boîte mail avant d'en redemander un.",
};

/** Comme traduireErreurAuth, mais un délai dépassé donne le message d'issue incertaine de `action`. */
export function traduireErreurAuthPour(err: unknown, action: ActionAuthNonIdempotente): string {
    if (estDelaiDepasse(err)) return REPONSE_TARDIVE[action];
    return traduireErreurAuth(err as ErreurAuth | null | undefined);
}
