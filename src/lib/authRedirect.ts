// Mémorise la dernière page « normale » visitée avant une bascule vers l'authentification,
// pour y ramener l'utilisateur une fois connecté (repli : accueil).
// sessionStorage → survit au round-trip OAuth (même origine, même onglet).

const KEY = 'lex_return_to';
const AUTH_PATHS = ['/login', '/signup', '/auth/callback'];

const isAuthPath = (path: string) => AUTH_PATHS.some((p) => path.startsWith(p));

/** Appelé à chaque navigation : retient la page courante si ce n'est pas un écran d'auth. */
export function recordOrigin(path: string): void {
    try {
        if (!isAuthPath(path)) sessionStorage.setItem(KEY, path);
    } catch { /* quota / mode privé */ }
}

/** Récupère la page d'origine (et la consomme). Repli sur l'accueil. */
export function popReturnPath(): string {
    try {
        const v = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        return v && !isAuthPath(v) ? v : '/';
    } catch {
        return '/';
    }
}
