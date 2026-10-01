/**
 * Mention de publication au Journal officiel du Sénégal, à partir de laws_and_codes.jo_numero /
 * jo_date / jo_page. Ces colonnes ne sont remplies que pour des références vérifiées sur pièce
 * (chantier « Archive du Journal officiel », 01/10/2026). Mention complète ou rien : jamais
 * de numéro sans date ni l'inverse. Même règle côté serveur (api/render.js, joReferenceSsr).
 */
export interface JoFields {
    jo_numero?: string | null;
    jo_date?: string | null;
    jo_page?: number | null;
}

export function formatJoReference(law: JoFields): string | null {
    if (!law.jo_numero || !law.jo_date) return null;
    const d = new Date(law.jo_date);
    if (isNaN(d.getTime())) return null;
    // Date ISO sans heure = minuit UTC : afficher en UTC, sinon la veille s'affiche à l'ouest de Greenwich.
    const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .replace(/^1 /, '1er ');
    const page = law.jo_page ? `, p. ${law.jo_page}` : '';
    return `Journal officiel n° ${law.jo_numero} du ${date}${page}`;
}
