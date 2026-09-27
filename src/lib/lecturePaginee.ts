/**
 * Lecture PAGINÉE d'une requête PostgREST.
 *
 * PostgREST plafonne chaque réponse à 1 000 lignes, EN SILENCE : un code de 1 104 articles
 * (AUSCGIE) arrivait amputé de ses 104 derniers, sans erreur. Toute lecture qui peut dépasser
 * ce plafond passe donc par ici.
 *
 * ⚠️ La requête doit être triée sur une clé UNIQUE (ou se terminer par un départage sur `id`) :
 * sans ordre total, deux pages successives peuvent sauter ou doubler des lignes.
 *
 * Pas d'import de supabase ici : la fonction reste pure et testable (voir articlesDuCode.ts
 * pour les lectures concrètes).
 */

/** Taille de page imposée par PostgREST (plafond serveur, pas un choix). */
export const TAILLE_PAGE = 1000;

export type LecturePage<T> = (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Lit toutes les pages jusqu'à épuisement (page incomplète). Une page en échec lève l'erreur :
 * mieux vaut un échec visible qu'une liste tronquée présentée comme complète.
 */
export async function lireToutesLesPages<T>(lirePage: LecturePage<T>, taille: number = TAILLE_PAGE): Promise<T[]> {
    const lignes: T[] = [];
    for (let de = 0; ; de += taille) {
        const { data, error } = await lirePage(de, de + taille - 1);
        if (error) throw error;
        const page = data || [];
        lignes.push(...page);
        if (page.length < taille) return lignes;
    }
}
