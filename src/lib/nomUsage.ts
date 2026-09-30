/**
 * Recherche par nom d'usage (noms des parties tels que les praticiens les connaissent).
 *
 * La RPC `search_decisions_nom_usage` compare la saisie à des noms conservés HORS des décisions
 * (schéma privé) et renvoie des décisions pseudonymisées : le nom n'est jamais renvoyé ni affiché.
 * Ces fonctions pures servent à décider quand l'interroger, à fusionner ses résultats avec ceux de
 * la recherche habituelle et à leur appliquer les mêmes filtres.
 */
import { MATIERE_NON_RENSEIGNEE, SEP_CHAMBRE } from './recherche';

export interface DecisionNomUsage {
    id: string;
    reference?: string;
    slug?: string;
    date_decision?: string | null;
    juridiction?: string | null;
    chambre?: string | null;
    matiere_principale?: string | null;
    resume?: string | null;
    mots_cles?: string[] | null;
    /** Vrai si la décision remonte grâce au nom d'usage (mention sur la carte, jamais le nom). */
    parNomUsage?: boolean;
}

export interface FiltresRecherche {
    matiere?: string[] | null;
    /** Couples « Juridiction::Chambre » (ou chambre seule), comme pour les RPC de décisions. */
    chambre?: string[] | null;
    juridiction?: string[] | null;
    date_from?: string | null;
    date_to?: string | null;
}

/** Même borne que la RPC : au moins deux mots et 5 caractères, au plus 150 caractères. */
export function doitChercherParNom(saisie: string): boolean {
    const q = (saisie || '').trim().replace(/\s+/g, ' ');
    return q.length >= 5 && q.length <= 150 && q.includes(' ');
}

/** Résultats par nom en tête (marqués), puis les résultats habituels sans doublon. */
export function fusionnerResultats<T extends DecisionNomUsage>(habituels: T[], parNom: T[]): T[] {
    const vus = new Set<string>();
    const out: T[] = [];
    for (const d of parNom) {
        if (vus.has(d.id)) continue;
        vus.add(d.id);
        out.push({ ...d, parNomUsage: true });
    }
    for (const d of habituels) {
        if (vus.has(d.id)) continue;
        vus.add(d.id);
        out.push(d);
    }
    return out;
}

/** Applique aux résultats par nom les filtres actifs de la recherche (matière, chambre, juridiction, dates). */
export function filtrerCommeLaRecherche<T extends DecisionNomUsage>(lignes: T[], f: FiltresRecherche): T[] {
    return lignes.filter((d) => {
        if (f.matiere?.length) {
            const m = d.matiere_principale || null;
            const ok = m ? f.matiere.includes(m) : f.matiere.includes(MATIERE_NON_RENSEIGNEE);
            if (!ok) return false;
        }
        if (f.chambre?.length) {
            const couple = `${d.juridiction ?? ''}${SEP_CHAMBRE}${d.chambre ?? ''}`;
            const ok = f.chambre.some((c) => (c.includes(SEP_CHAMBRE) ? c === couple : c === (d.chambre ?? '')));
            if (!ok) return false;
        }
        if (f.juridiction?.length && !f.juridiction.includes(d.juridiction ?? '')) return false;
        if (f.date_from && (!d.date_decision || d.date_decision < f.date_from)) return false;
        if (f.date_to && (!d.date_decision || d.date_decision > f.date_to)) return false;
        return true;
    });
}
