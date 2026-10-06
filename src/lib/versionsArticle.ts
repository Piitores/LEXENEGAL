/**
 * versionsArticle - choix de la version d'un article à afficher, et adresses datées.
 *
 * Décisions du propriétaire (02/10/2026, fusion des codes 2026) : un seul Code du travail et un
 * seul Code de la sécurité sociale. Le texte de 1997 (resp. 1973) devient la VERSION ANTÉRIEURE des
 * articles 2026, rattachée PAR SUJET (concordance), jamais par numéro. Un lien depuis une décision
 * ouvre l'article dans la version en vigueur à la date de la décision, visible de TOUS :
 *   /code/<code>/<article>?ancien=<NORM>&date=<AAAA-MM-JJ>   (les deux paramètres facultatifs)
 * Le canonical reste toujours l'adresse sans paramètre.
 *
 * Logique PURE (aucune I/O), testée (src/lib/__tests__/versionsArticle.test.ts). La même règle
 * (contrat de la fusion, §3) est recopiée à l'identique dans le rendu serveur (api/render.js) :
 * la modifier ici impose de la modifier là-bas.
 */

/** Une version d'article (table article_versions). Dates au format AAAA-MM-JJ. */
export interface VersionArticle {
    id: string;
    content: string;
    effective_date: string;
    expiration_date: string | null;
    is_current: boolean | null;
    /** Numéro ancien brut (« L.56. ») dont la version reprend le texte ; NULL = l'article lui-même. */
    ancien_numero?: string | null;
    version_note?: string | null;
    /**
     * Copie d'un ancien article (fusion des codes 2026) : 'sujet' = successeur par la concordance ;
     * 'numero' = ancien article de MÊME NUMÉRO, copié pour la SEULE comparaison (décision du
     * propriétaire du 02/10/2026), jamais retenu comme « version en vigueur à une date ».
     */
    lien_ancien?: string | null;
}

/**
 * Copie « même numéro » (lien_ancien = 'numero') : elle n'a aucun lien juridique avec l'article
 * (l'ancien L.87 n'est pas l'ancêtre de l'art. 87 de 2026), elle ne sert qu'au comparateur.
 */
export function estCopieMemeNumero(v: Pick<VersionArticle, 'lien_ancien'>): boolean {
    return v.lien_ancien === 'numero';
}

/** Paramètres d'adresse d'une version : `date` validée, `ancien` normalisé (normAncien). */
export interface ParamsVersion {
    date: string | null;
    ancien: string | null;
}

export type HorsPeriode = null | 'avant' | 'apres';

export interface ChoixVersions<V extends VersionArticle = VersionArticle> {
    /** Versions à afficher (une, ou une par prédécesseur), dans l'ordre des dates d'effet. */
    versions: V[];
    /** La version retenue est la version courante : affichage habituel, sans bandeau. */
    estActuelle: boolean;
    /** La date demandée tombe avant la première version connue, ou après la dernière. */
    horsPeriode: HorsPeriode;
}

export const AUCUN_PARAMETRE: ParamsVersion = { date: null, ancien: null };

// ---------------------------------------------------------------------------
// Normalisation des numéros (copie fidèle de la fonction SQL fn_norm_article)
// ---------------------------------------------------------------------------

const PREMIER = new Set(['PREMIER', 'PREMIRE', 'PREMIERE', '1ER', '1ERE', 'IER']);

/**
 * Copie FIDÈLE de fn_norm_article (base) : retire un « ART », « ART. », « ARTICLE » de tête, passe
 * en majuscules, ne garde que [A-Z0-9-] (les accents disparaissent : « Première » → « PREMIRE »),
 * puis ramène les formes de « premier » à « 1 ». 'L.56.' → 'L56' ; 'L76 bis' → 'L76BIS' ;
 * 'L.29-1' → 'L29-1' ; 'premier' → '1' ; '182 (suite)' → '182SUITE'.
 * C'est la clé de la concordance (article_concordance.ancien_norm) et du paramètre ?ancien=.
 */
export function normAncien(numero: string | null | undefined): string {
    const x = (numero ?? '')
        .replace(/^\s*ART(ICLE)?\.?\s*/i, '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '');
    return PREMIER.has(x) ? '1' : x;
}

/** Numéro ancien tel qu'on l'affiche : sans point final (« L.56. » → « L.56 »). */
export function numeroAncienAffiche(numero: string | null | undefined): string {
    return (numero ?? '').trim().replace(/\.+$/, '').trim();
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Date réelle au format AAAA-MM-JJ (« 2015-02-30 » est refusée). */
export function estDateValide(s: string | null | undefined): s is string {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [a, m, j] = s.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1, j));
    return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

/** Partie AAAA-MM-JJ d'une date (une colonne date, ou un horodatage ISO). */
export function jourDe(s: string | null | undefined): string {
    return (s ?? '').slice(0, 10);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
    'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2015-03-04 » → « 4 mars 2015 » ; « 1997-12-01 » → « 1er décembre 1997 ». */
export function dateLongue(iso: string): string {
    const [a, m, j] = jourDe(iso).split('-').map(Number);
    if (!a || !m || !j) return iso;
    return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`;
}

/** « 1997-12-01 » → « 01/12/1997 », sans passer par le fuseau du navigateur. */
export function dateCourte(iso: string): string {
    const [a, m, j] = jourDe(iso).split('-');
    return a && m && j ? `${j}/${m}/${a}` : iso;
}

/** Jour précédent : une version qui expire le 3 septembre était en vigueur jusqu'au 2. */
export function veille(iso: string): string {
    const [a, m, j] = jourDe(iso).split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
}

const JOUR_MS = 86_400_000;
const ecartEnJours = (de: string, a: string) => Math.abs(Date.parse(a) - Date.parse(de)) / JOUR_MS;

// ---------------------------------------------------------------------------
// Paramètres d'adresse
// ---------------------------------------------------------------------------

/**
 * Lit ?date= et ?ancien= dans une query string (avec ou sans « ? »). Une date mal formée ou
 * irréelle est ignorée ; `ancien` est normalisé (normAncien), vide → null.
 */
export function lireParamsVersion(search: string): ParamsVersion {
    let sp: URLSearchParams;
    try {
        sp = new URLSearchParams(search || '');
    } catch {
        return { ...AUCUN_PARAMETRE };
    }
    const date = (sp.get('date') || '').trim();
    const ancien = normAncien(sp.get('ancien'));
    return { date: estDateValide(date) ? date : null, ancien: ancien || null };
}

/** Query string d'une version : « ?ancien=L56&date=2015-03-04 », « ?date=… », ou « ». */
export function requeteVersion(p: Partial<ParamsVersion> | null | undefined): string {
    const parts: string[] = [];
    const ancien = normAncien(p?.ancien);
    if (ancien) parts.push(`ancien=${encodeURIComponent(ancien)}`);
    if (estDateValide(p?.date)) parts.push(`date=${p!.date}`);
    return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
// Choix de la version (contrat §3)
// ---------------------------------------------------------------------------

/**
 * Chaîne d'une version : normAncien(ancien_numero), et pour une version sans ancien numéro, le
 * numéro de l'article lui-même. (Vérifié en base le 02/10/2026 : aucun ancien numéro de la
 * concordance n'est égal au numéro 2026 de son successeur, les chaînes ne se mélangent pas.)
 */
export function cleChaine(v: VersionArticle, articleNumber?: string | null): string {
    return normAncien(v.ancien_numero ?? articleNumber ?? '');
}

/** Tri stable : dates d'effet croissantes. */
const anciennesDabord = <V extends VersionArticle>(vs: V[]): V[] =>
    vs.map((v, i) => [v, i] as const)
        .sort((x, y) => (jourDe(x[0].effective_date) < jourDe(y[0].effective_date) ? -1
            : jourDe(x[0].effective_date) > jourDe(y[0].effective_date) ? 1 : x[1] - y[1]))
        .map(([v]) => v);

/** Tri stable : dates d'effet décroissantes (ordre de lecture de la page aujourd'hui). */
const recentesDabord = <V extends VersionArticle>(vs: V[]): V[] =>
    vs.map((v, i) => [v, i] as const)
        .sort((x, y) => (jourDe(x[0].effective_date) > jourDe(y[0].effective_date) ? -1
            : jourDe(x[0].effective_date) < jourDe(y[0].effective_date) ? 1 : x[1] - y[1]))
        .map(([v]) => v);

/** Version courante : la plus récente des is_current, sinon la plus récente (règle d'aujourd'hui). */
export function versionCourante<V extends VersionArticle>(versions: V[]): V | null {
    const triees = recentesDabord(versions || []);
    return triees.find((v) => v.is_current) ?? triees[0] ?? null;
}

/**
 * Fin d'une version (exclue) : expiration_date, à défaut la date d'effet de la version suivante de
 * la même chaîne, à défaut null (= +infini). Tolère les expirations manquantes des anciennes
 * versions (L.24, L.25, L.69… au Code du travail de 1997), sans corriger une date inversée.
 */
export function finVersion<V extends VersionArticle>(v: V, versions: V[], articleNumber?: string | null): string | null {
    if (v.expiration_date) return jourDe(v.expiration_date);
    const cle = cleChaine(v, articleNumber);
    const debut = jourDe(v.effective_date);
    let suivante: string | null = null;
    for (const w of versions) {
        if (w === v || cleChaine(w, articleNumber) !== cle) continue;
        const d = jourDe(w.effective_date);
        if (d > debut && (suivante === null || d < suivante)) suivante = d;
    }
    return suivante;
}

const enVigueurLe = <V extends VersionArticle>(v: V, date: string, versions: V[], articleNumber?: string | null) => {
    const fin = finVersion(v, versions, articleNumber);
    return jourDe(v.effective_date) <= date && (fin === null || date < fin);
};

interface Candidat<V> { version: V; horsPeriode: HorsPeriode; ecart: number }

/** Version d'UNE chaîne pour une date : celle qui la couvre, sinon la plus proche (horsPeriode). */
function versionDeLaChaine<V extends VersionArticle>(
    chaine: V[], date: string, versions: V[], articleNumber?: string | null,
): Candidat<V> {
    const triees = anciennesDabord(chaine);
    const couvrantes = triees.filter((v) => enVigueurLe(v, date, versions, articleNumber));
    if (couvrantes.length) return { version: couvrantes[couvrantes.length - 1], horsPeriode: null, ecart: 0 };
    const premiere = triees[0];
    if (date < jourDe(premiere.effective_date)) {
        return { version: premiere, horsPeriode: 'avant', ecart: ecartEnJours(date, jourDe(premiere.effective_date)) };
    }
    // Au-delà de la dernière version (ou dans un trou de la chaîne) : la dernière entrée en vigueur
    // avant la date.
    const precedentes = triees.filter((v) => jourDe(v.effective_date) <= date);
    const version = precedentes[precedentes.length - 1];
    const fin = finVersion(version, versions, articleNumber) ?? date;
    return { version, horsPeriode: 'apres', ecart: ecartEnJours(fin, date) };
}

/** Ordre de sortie : dates d'effet, puis ancien numéro (ordre naturel : L.2 avant L.36). */
function ordonner<V extends VersionArticle>(vs: V[]): V[] {
    return vs.map((v, i) => [v, i] as const)
        .sort(([a, i], [b, j]) => {
            const da = jourDe(a.effective_date), db = jourDe(b.effective_date);
            if (da !== db) return da < db ? -1 : 1;
            const n = numeroAncienAffiche(a.ancien_numero)
                .localeCompare(numeroAncienAffiche(b.ancien_numero), 'fr', { numeric: true });
            return n || i - j;
        })
        .map(([v]) => v);
}

/**
 * Versions à afficher pour des paramètres d'adresse (contrat de la fusion, §3) :
 * 1. sans date ni ancien : la version courante (comportement d'avant la fusion) ;
 * 2. fin d'une version : cf. finVersion ;
 * 3. avec `ancien` : la chaîne de cet ancien numéro ; avec `date`, la version qui la couvre (sinon la
 *    première, horsPeriode 'avant', ou la dernière, 'apres') ; sans date, la dernière de la chaîne ;
 *    chaîne vide (paramètre faux) : cas 1, sans bandeau ;
 * 4. avec `date` seule : les versions en vigueur à cette date, une par chaîne ; si aucune, la plus
 *    proche (horsPeriode) ; si la seule retenue est la courante : cas 1.
 */
export function choisirVersions<V extends VersionArticle>(
    versions: V[],
    params: Partial<ParamsVersion> | null | undefined,
    articleNumber?: string | null,
): ChoixVersions<V> {
    // Les copies « même numéro » ne sont proposées que par le comparateur (02/10/2026).
    const toutes = (versions || []).filter((v) => !estCopieMemeNumero(v));
    const courante = versionCourante(toutes);
    const actuelle: ChoixVersions<V> = { versions: courante ? [courante] : [], estActuelle: true, horsPeriode: null };
    if (!courante) return actuelle;

    const date = estDateValide(params?.date) ? params!.date! : null;
    const ancien = normAncien(params?.ancien);
    const resultat = (choisies: V[], horsPeriode: HorsPeriode): ChoixVersions<V> => {
        if (!choisies.length || (choisies.length === 1 && choisies[0].id === courante.id)) return actuelle;
        return { versions: ordonner(choisies), estActuelle: false, horsPeriode };
    };

    if (ancien) {
        const chaine = toutes.filter((v) => cleChaine(v, articleNumber) === ancien);
        if (!chaine.length) return actuelle;
        if (!date) return resultat([anciennesDabord(chaine)[chaine.length - 1]], null);
        const c = versionDeLaChaine(chaine, date, toutes, articleNumber);
        return resultat([c.version], c.horsPeriode);
    }

    if (date) {
        const chaines = new Map<string, V[]>();
        for (const v of toutes) {
            const cle = cleChaine(v, articleNumber);
            chaines.set(cle, [...(chaines.get(cle) || []), v]);
        }
        const enVigueur: V[] = [];
        for (const chaine of chaines.values()) {
            const couvrantes = anciennesDabord(chaine).filter((v) => enVigueurLe(v, date, toutes, articleNumber));
            if (couvrantes.length) enVigueur.push(couvrantes[couvrantes.length - 1]);
        }
        if (enVigueur.length) return resultat(enVigueur, null);
        // Aucune version en vigueur à cette date : la plus proche, chaîne par chaîne.
        const candidats = [...chaines.values()].map((ch) => versionDeLaChaine(ch, date, toutes, articleNumber));
        const ecartMin = Math.min(...candidats.map((c) => c.ecart));
        const proches = candidats.filter((c) => c.ecart === ecartMin);
        return resultat(proches.map((c) => c.version), proches[0].horsPeriode);
    }

    return actuelle;
}

// ---------------------------------------------------------------------------
// Libellés (bandeaux, sélecteur du comparateur, copie)
// ---------------------------------------------------------------------------

/** « a », « a et b », « a, b et c ». */
export function listeFr(items: string[]): string {
    if (items.length <= 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Anciens numéros affichés des versions retenues, sans doublon (« L.56 »). */
export function anciensNumerosAffiches(versions: VersionArticle[]): string[] {
    const vus: string[] = [];
    for (const v of versions) {
        const n = numeroAncienAffiche(v.ancien_numero);
        if (n && !vus.includes(n)) vus.push(n);
    }
    return vus;
}

/** « l'ancien article L.56 », « les anciens articles L.2 et L.3 » (vide si aucun). */
export function mentionAnciens(numeros: string[]): string {
    if (!numeros.length) return '';
    return numeros.length === 1 ? `l'ancien article ${numeros[0]}` : `les anciens articles ${listeFr(numeros)}`;
}

/**
 * Texte du bandeau d'une version qui n'est pas la courante (la suite « - voir la version
 * actuelle » est un lien, posé par la page). null si la version affichée est la courante.
 * « Version en vigueur le 4 mars 2015 (ancien article L.56) » ;
 * « Rédaction de l'ancien article L.56, en vigueur jusqu'au 2 septembre 2026 » (sans date) ;
 * « Version la plus ancienne disponible, en vigueur à partir du 1er décembre 1997 (ancien article L.56) ».
 */
export function libelleBandeauVersion<V extends VersionArticle>(
    choix: ChoixVersions<V>,
    params: Partial<ParamsVersion> | null | undefined,
    versions: V[],
    articleNumber?: string | null,
): string | null {
    if (choix.estActuelle || !choix.versions.length) return null;
    const numeros = anciensNumerosAffiches(choix.versions);
    const anciens = mentionAnciens(numeros);
    // Entre parenthèses, sans article : « (ancien article L.56) », « (anciens articles L.2 et L.3) ».
    const parenthese = !numeros.length ? ''
        : numeros.length === 1 ? ` (ancien article ${numeros[0]})` : ` (anciens articles ${listeFr(numeros)})`;
    const premiere = choix.versions[0];
    const derniere = choix.versions[choix.versions.length - 1];
    const date = estDateValide(params?.date) ? params!.date! : null;

    if (choix.horsPeriode === 'avant') {
        return `Version la plus ancienne disponible, en vigueur à partir du ${dateLongue(premiere.effective_date)}${parenthese}`;
    }
    if (date && choix.horsPeriode === null) {
        return `Version en vigueur le ${dateLongue(date)}${parenthese}`;
    }
    // Sans date, ou date au-delà de la dernière version de la chaîne.
    const fin = finVersion(derniere, versions, articleNumber);
    const jusquAu = fin ? `, en vigueur jusqu'au ${dateLongue(veille(fin))}` : '';
    if (anciens) {
        // « de l'ancien article L.56 », « des anciens articles L.2 et L.3 »
        const de = anciens.startsWith('les ') ? `des ${anciens.slice(4)}` : `de ${anciens}`;
        return `Rédaction ${de}${jusquAu}`;
    }
    return `Version antérieure${jusquAu}`;
}

/**
 * Date des citations d'une version affichée (renvois vers un code refondu, cf. resoudreRenvoi) :
 * - version reprise d'un ancien article (ancien_numero) : sa date d'effet, mais jamais avant le début
 *   de l'ancienne numérotation (`numerotationDepuis`, concordance). Une version copiée de l'ancien
 *   code est par définition rédigée dans sa numérotation ; or deux anciennes versions du Code du
 *   travail (L.69, L.279) portent la date d'effet du 30/11/1997, la veille du 1er décembre 1997 :
 *   leurs renvois (« article L 4 ») restaient sans lien (relecture du 02/10/2026) ;
 * - sinon : la date de publication du texte affiché (contrat de la fusion, §4).
 */
export function dateCitationVersion(
    v: Pick<VersionArticle, 'ancien_numero' | 'effective_date'>,
    publicationDate: string | null | undefined,
    numerotationDepuis: string | null | undefined,
): string | null {
    if (!v.ancien_numero) return publicationDate ?? null;
    const jour = jourDe(v.effective_date);
    const debut = jourDe(numerotationDepuis);
    return estDateValide(jour) && estDateValide(debut) && jour < debut ? debut : jour;
}

/**
 * Anciens numéros cités par une décision (decision_article_links.anciens_numeros), sans celui de
 * l'article affiché. La migration note sur les liens vers un ancien article NON REPRIS son propre
 * numéro : sur la page de L.10, « cite l'ancien article L.10 » et un lien « Texte alors en vigueur »
 * qui ramenait à la même page n'apprenaient rien au lecteur (relecture du 02/10/2026). (Aucun ancien
 * numéro de la concordance n'est égal au numéro 2026 de son successeur : vérifié le 02/10/2026.)
 */
export function anciensNumerosCites(
    anciens: (string | null | undefined)[] | null | undefined,
    articleNumber: string | null | undefined,
): string[] {
    const propre = normAncien(articleNumber);
    return (anciens || []).filter((n): n is string => !!normAncien(n) && normAncien(n) !== propre);
}

/** Libellé d'une version dans le sélecteur du comparateur : « Version du 01/12/1997 (Ancien article L.56) ». */
export function libelleVersionComparateur(v: VersionArticle): string {
    const note = v.version_note
        || (v.ancien_numero ? `Ancien article ${numeroAncienAffiche(v.ancien_numero)}` : '');
    // Copie d'un ancien article : l'ancien numéro d'abord, la date ensuite, sans parenthèses
    // imbriquées (« Ancien article L.87 (même numéro) - version du 01/12/1997 », 02/10/2026).
    if (/^Ancien article /.test(note)) return `${note} - version du ${dateCourte(v.effective_date)}`;
    return `Version du ${dateCourte(v.effective_date)}${note ? ` (${note})` : ''}`;
}

/** Titre de la section d'une version quand plusieurs prédécesseurs s'affichent ensemble. */
export function titreSectionVersion(v: VersionArticle, libelleArticle: string): string {
    const n = numeroAncienAffiche(v.ancien_numero);
    return n ? `Ancien article ${n}` : libelleArticle;
}

/**
 * Référence emportée par une copie (useCopyAttribution) : en mode daté, le texte collé ailleurs
 * ne doit pas passer pour l'article en vigueur. « Article 137 (version en vigueur le 4 mars 2015,
 * ancien art. L.56) » + « ?ancien=L56&date=2015-03-04 » à ajouter à l'adresse.
 */
export function referenceCopie<V extends VersionArticle>(
    libelleArticle: string,
    choix: ChoixVersions<V>,
    params: Partial<ParamsVersion> | null | undefined,
    versions: V[],
    articleNumber?: string | null,
): { num: string; requete: string } {
    if (choix.estActuelle || !choix.versions.length) return { num: libelleArticle, requete: '' };
    const date = estDateValide(params?.date) ? params!.date! : null;
    const premiere = choix.versions[0];
    const derniere = choix.versions[choix.versions.length - 1];
    let quand: string;
    if (choix.horsPeriode === 'avant') {
        quand = `version en vigueur à partir du ${dateLongue(premiere.effective_date)}`;
    } else if (date && choix.horsPeriode === null) {
        quand = `version en vigueur le ${dateLongue(date)}`;
    } else {
        const fin = finVersion(derniere, versions, articleNumber);
        quand = fin ? `version en vigueur jusqu'au ${dateLongue(veille(fin))}` : 'version antérieure';
    }
    const anciens = anciensNumerosAffiches(choix.versions);
    const mention = anciens.length ? `, ${anciens.length > 1 ? 'anciens' : 'ancien'} art. ${listeFr(anciens)}` : '';
    return { num: `${libelleArticle} (${quand}${mention})`, requete: requeteVersion(params) };
}

/**
 * Bandeau d'un ancien article NON REPRIS par le code refondu (concordance « identite »). Le texte
 * est construit à partir des données du texte (sa référence), jamais tiré de `notes`.
 * « Article non repris par la loi n° 2026-18 du 3 septembre 2026 ; il reste consultable dans sa
 * rédaction antérieure. »
 */
export function libelleNonRepris(reference: string | null | undefined): string {
    const ref = (reference || '').trim();
    const suite = ' ; il reste consultable dans sa rédaction antérieure.';
    if (!ref) return `Article non repris par le texte en vigueur${suite}`;
    const m = ref.match(/^(loi|d[ée]cret|ordonnance)\b/i);
    if (!m) return `Article non repris par le texte en vigueur (${ref})${suite}`;
    const nature = m[1].toLowerCase();
    const article = nature === 'loi' ? 'la ' : nature === 'ordonnance' ? "l'" : 'le ';
    return `Article non repris par ${article}${nature}${ref.slice(m[1].length)}${suite}`;
}

/**
 * Article abrogé (statut « abrogé ») ou retiré (`is_active` faux). Sa version sans date de fin n'est
 * jamais « en vigueur depuis » : 132 articles abrogés affichaient « En vigueur depuis le … » sous le
 * bandeau « abrogé », souvent avec une date de remplissage (« 1er janvier 2000 ») (06/10/2026).
 */
export function estAbroge(a: { status?: string | null; is_active?: boolean | null } | null | undefined): boolean {
    return !!a && (a.status === 'abrogé' || a.is_active === false);
}

/** Version sans date de fin : « En vigueur depuis le 3 septembre 2026 », ou « Article abrogé ». */
export function libelleSansFin(effectiveDate: string, abroge = false): string {
    return abroge ? 'Article abrogé' : `En vigueur depuis le ${dateLongue(effectiveDate)}`;
}

/**
 * Période d'une version : « En vigueur du 1er décembre 1997 au 2 septembre 2026 », ou, sans fin,
 * libelleSansFin (« En vigueur depuis le 3 septembre 2026 », « Article abrogé » si `abroge`).
 * ⚠️ COPIE côté serveur : libellePeriodeSsr (api/render.js), à modifier ensemble.
 */
export function libellePeriode<V extends VersionArticle>(v: V, versions: V[], articleNumber?: string | null, abroge = false): string {
    const fin = finVersion(v, versions, articleNumber);
    return fin
        ? `En vigueur du ${dateLongue(v.effective_date)} au ${dateLongue(veille(fin))}`
        : libelleSansFin(v.effective_date, abroge);
}

/** Ligne de concordance, réduite à ce qu'il faut pour les autres successeurs d'un ancien article. */
export interface RepriseConcordance {
    ancien_norm: string;
    role: string;
    article_id: string;
    article?: { slug: string; article_number: string } | null;
}

/** Autres articles qui reprennent le texte d'un ancien article affiché. */
export interface AutresReprises {
    ancienAffiche: string;
    ancienNorm: string;
    articles: { slug: string; article_number: string }[];
}

/**
 * Pour chaque ancien article dont une version est affichée, les AUTRES articles qui en reprennent
 * le texte (concordance principal ou secondaire : l'ancien L.56 est repris aux art. 137 et 138).
 * Sert à la mention « Le texte de l'ancien article L.56 est aussi repris à l'article 138. »
 */
export function autresSuccesseurs(
    lignes: RepriseConcordance[],
    affichees: VersionArticle[],
    articleId: string,
): AutresReprises[] {
    const out: AutresReprises[] = [];
    for (const v of affichees) {
        const ancienNorm = normAncien(v.ancien_numero);
        if (!ancienNorm || out.some((o) => o.ancienNorm === ancienNorm)) continue;
        const articles: { slug: string; article_number: string }[] = [];
        for (const l of lignes) {
            if (l.ancien_norm !== ancienNorm || l.article_id === articleId || !l.article) continue;
            if (l.role !== 'principal' && l.role !== 'secondaire') continue;
            if (!articles.some((a) => a.slug === l.article!.slug)) articles.push({ slug: l.article.slug, article_number: l.article.article_number });
        }
        if (articles.length) out.push({ ancienAffiche: numeroAncienAffiche(v.ancien_numero), ancienNorm, articles });
    }
    return out;
}
