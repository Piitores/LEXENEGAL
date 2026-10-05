import { describe, it, expect } from 'vitest';
import { formatNodeLabel } from '../codeTree';

/*
 * Libellés des niveaux du plan (badge + intitulé) : arbre, « emplacement dans le texte », titre de la
 * division ouverte. Relecture du 05/10/2026 : quand la colonne `numero` contenait le mot de niveau
 * (« TITRE IV », « PREMIÈRE PARTIE »), le numéro DISPARAISSAIT du badge (« Titre » seul) ; les divisions
 * perdaient le leur (« I - EMBAUCHE » devenait « EMBAUCHE ») ; 114 nœuds du CGI affichaient le type brut
 * « sous_section ». Sur les 5 922 nœuds de la base, 946 perdaient un mot par rapport au libellé que la
 * production servait (libelleNiveau, 35c1a9c). Cas réels de la base ; la copie serveur (api/render.js)
 * doit répondre à l'identique.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

type Noeud = { type: string; numero: string | null; intitule: string | null; label?: string };
const CAS: [Noeud, string, string][] = [
    // Mot de niveau dans la colonne numero : le numéro reste (code forestier, code de l'électricité).
    [{ type: 'titre', numero: 'TITRE IV', intitule: 'Des dispositions pénales' }, 'Titre IV', 'Des dispositions pénales'],
    [{ type: 'chapitre', numero: 'Chapitre premier', intitule: 'Dispositions générales' }, 'Chapitre premier', 'Dispositions générales'],
    [{ type: 'section', numero: 'Section première', intitule: 'Des acteurs institutionnels' }, 'Section première', 'Des acteurs institutionnels'],
    [{ type: 'sous-section', numero: 'Sous-section II', intitule: 'Des dispositions spécifiques' }, 'Sous-section II', 'Des dispositions spécifiques'],
    [{ type: 'titre', numero: 'TITRE PREMIER BIS', intitule: 'DE LA CESSION VOLONTAIRE' }, 'Titre PREMIER BIS', 'DE LA CESSION VOLONTAIRE'],
    [{ type: 'paragraphe', numero: 'Paragraphe 2 bis', intitule: 'De l’exception préjudicielle' }, 'Paragraphe 2 bis', 'De l’exception préjudicielle'],
    // Mot de niveau APRÈS l'ordinal (code de procédure civile).
    [{ type: 'partie', numero: 'PREMIÈRE PARTIE', intitule: 'DE LA PROCÉDURE ORDINAIRE' }, 'Partie PREMIÈRE', 'DE LA PROCÉDURE ORDINAIRE'],
    // « § 1 », « sous-paragraphe 1 » : le numéro, sous le bon mot.
    [{ type: 'paragraphe', numero: '§ 1', intitule: 'Droits exclusifs' }, 'Paragraphe 1', 'Droits exclusifs'],
    [{ type: 'paragraphe', numero: 'sous-paragraphe 1', intitule: 'Droits' }, 'Sous-paragraphe 1', 'Droits'],
    // Numéro et titre collés dans la colonne numero, intitulé vide.
    [{ type: 'titre', numero: 'TITRE III. DES BAUX A CONSTRUCTION', intitule: null, label: 'TITRE III. DES BAUX A CONSTRUCTION' }, 'Titre III', 'DES BAUX A CONSTRUCTION'],
    // Numéros qui ne sont pas des chiffres : gardés tels quels, jamais effacés.
    [{ type: 'chapitre', numero: 'unique', intitule: 'Le Fonds de garantie automobile' }, 'Chapitre unique', 'Le Fonds de garantie automobile'],
    [{ type: 'chapitre', numero: 'préliminaire', intitule: 'Champ d’application' }, 'Chapitre préliminaire', 'Champ d’application'],
    [{ type: 'chapitre', numero: '2-1', intitule: 'Attribution gratuite d’actions' }, 'Chapitre 2-1', 'Attribution gratuite d’actions'],
    [{ type: 'section', numero: '1ère', intitule: 'Du but de l’Institution' }, 'Section 1ère', 'Du but de l’Institution'],
    // Le numéro qui répète l'intitulé n'est pas doublé.
    [{ type: 'titre', numero: 'Signature', intitule: 'Signature' }, 'Titre', 'Signature'],
    // Divisions numérotées (convention collective) : le numéro seul, sans mot de niveau inventé.
    [{ type: 'division', numero: 'I', intitule: 'EMBAUCHE' }, 'I', 'EMBAUCHE'],
    [{ type: 'division', numero: null, intitule: 'Autres dispositions', label: 'Autres dispositions' }, '', 'Autres dispositions'],
    // Types sans libellé jusqu'ici : plus jamais le type brut.
    [{ type: 'sous_section', numero: '3', intitule: 'EXONERATIONS' }, 'Sous-section 3', 'EXONERATIONS'],
    [{ type: 'annexe', numero: 'I', intitule: 'CLASSIFICATION PROFESSIONNELLE' }, 'Annexe I', 'CLASSIFICATION PROFESSIONNELLE'],
    [{ type: 'sous-chapitre', numero: '', intitule: 'DISPOSITIONS COMMUNES' }, 'Sous-chapitre', 'DISPOSITIONS COMMUNES'],
    [{ type: 'preambule', numero: null, intitule: 'Préambule' }, '', 'Préambule'],
    // Formes d'avant, inchangées.
    [{ type: 'titre', numero: 'II', intitule: 'Des personnes' }, 'Titre II', 'Des personnes'],
    [{ type: 'titre', numero: null, intitule: 'TITRE II - DES PERSONNES' }, 'Titre II', 'DES PERSONNES'],
    [{ type: 'livre', numero: null, intitule: 'DEUXIEME EFFETS DES OBLIGATIONS' }, 'Livre DEUXIEME', 'EFFETS DES OBLIGATIONS'],
    [{ type: 'livre', numero: 'Livre', intitule: 'DEUXIEME.- DE LA RESPONSABILITE' }, 'Livre DEUXIEME', 'DE LA RESPONSABILITE'],
    [{ type: 'point-lettre', numero: 'A', intitule: 'Limites du domaine public maritime' }, 'Point A', 'Limites du domaine public maritime'],
    [{ type: 'section', numero: null, intitule: 'CIVIL' }, 'Section', 'CIVIL'],
];

/* Libellé que la production servait avant la refonte (libelleNiveau, api/render.js de 35c1a9c), à titre de
 * référence : aucun de ses mots ne doit manquer au nouveau libellé (hors « Division » et « Point-lettre »,
 * noms de type jamais affichés par le site). */
const MOTS_NIVEAU: Record<string, string> = {
    partie: 'Partie', livre: 'Livre', titre: 'Titre', chapitre: 'Chapitre', section: 'Section',
    sous_section: 'Sous-section', 'sous-section': 'Sous-section', paragraphe: 'Paragraphe', annexe: 'Annexe',
};
const ORDINAUX = /^(PREMIER|PREMIERE|PREMIÈRE|SECOND|SECONDE|DEUXIEME|DEUXIÈME|TROISIEME|TROISIÈME|QUATRIEME|QUATRIÈME|CINQUIEME|CINQUIÈME|SIXIEME|SIXIÈME|SEPTIEME|SEPTIÈME|HUITIEME|HUITIÈME|NEUVIEME|NEUVIÈME|DIXIEME|DIXIÈME)\b\s*(.*)$/i;
function libelleProduction(n: Noeud): string {
    const mot = MOTS_NIVEAU[n.type] || (n.type ? n.type.charAt(0).toUpperCase() + n.type.slice(1) : '');
    const num = (n.numero || '').trim();
    const intitule = (n.intitule || n.label || '').trim();
    if (num) return `${mot} ${num}${intitule ? ` - ${intitule}` : ''}`;
    if (!intitule) return mot;
    const m = intitule.match(ORDINAUX);
    if (m && mot && !new RegExp(`\\b${mot}\\b`, 'i').test(intitule) && m[2]) return `${mot} ${m[1]} - ${m[2]}`;
    return intitule;
}
const mots = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

describe('libellés des niveaux du plan (formatNodeLabel)', () => {
    it('badge et intitulé attendus, cas réels de la base', () => {
        for (const [n, badge, label] of CAS) {
            expect({ n, r: formatNodeLabel({ ...n, name: n.label }) }).toEqual({ n, r: { badge, label } });
        }
    });
    it('aucun mot du libellé servi avant la refonte ne manque', () => {
        for (const [n] of CAS) {
            const r = formatNodeLabel({ ...n, name: n.label });
            const nouveaux = new Set(mots(`${r.badge} ${r.label}`));
            const manquants = mots(libelleProduction(n)).filter((w) => !nouveaux.has(w) && w !== 'division' && w !== 'lettre');
            expect({ n, manquants }).toEqual({ n, manquants: [] });
        }
    });
    it('jamais de type brut (« sous_section ») dans un badge', () => {
        for (const [n] of CAS) expect(formatNodeLabel({ ...n, name: n.label }).badge).not.toMatch(/_/);
    });
    it('type de nœud hostile : ni exception, ni valeur héritée de Object.prototype', () => {
        for (const type of ['chapitre(', 'sous[section', 'titre*', 'constructor', '__proto__', 'toString']) {
            const r = formatNodeLabel({ type, numero: null, intitule: 'Dispositions générales' });
            expect(typeof r.badge).toBe('string');
            expect(r.badge).not.toMatch(/function|object Object/);
        }
        expect(formatNodeLabel({ type: 'titre', numero: 'constructor', intitule: 'X' }).badge).toBe('Titre constructor');
    });
    it('copie serveur (api/render.js) identique', async () => {
        const { formatNodeLabelSsr } = await charger('render.js');
        for (const [n] of CAS) expect({ n, r: formatNodeLabelSsr({ ...n, name: n.label }) }).toEqual({ n, r: formatNodeLabel({ ...n, name: n.label }) });
        for (const type of ['chapitre(', 'constructor', '__proto__']) {
            const n = { type, numero: null, intitule: 'Dispositions générales' };
            expect(formatNodeLabelSsr(n)).toEqual(formatNodeLabel(n));
        }
    });
});
