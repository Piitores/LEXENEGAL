import { describe, it, expect } from 'vitest';
import {
    STATUT_CLE, accord, formatDateFr, formatDateHeureFr, formatSemaine, ilYA,
    libelleClient, libelleDomaine, libelleOutil, preparerBarres, semaineSuivie, statutCle,
} from '../../pages/Admin/usageFormat';

describe('libelleOutil', () => {
    it('traduit les 12 outils MCP', () => {
        expect(libelleOutil('search_legislation')).toBe('Recherche de textes');
        expect(libelleOutil('search_jurisprudence')).toBe('Recherche de jurisprudence');
        expect(libelleOutil('search_doctrine')).toBe('Recherche de doctrine');
        expect(libelleOutil('get_article')).toBe("Lecture d'un article");
        expect(libelleOutil('get_decision')).toBe("Lecture d'une décision");
        expect(libelleOutil('resolve_citation')).toBe("Résolution d'une référence");
        expect(libelleOutil('list_citing_decisions')).toBe('Décisions citant un article');
        expect(libelleOutil('list_cited_legislation')).toBe('Textes visés par une décision');
        expect(libelleOutil('list_article_doctrine')).toBe('Doctrine sur un article');
        expect(libelleOutil('list_article_annotations')).toBe("Annotations d'un article");
        expect(libelleOutil('list_doctrine_articles')).toBe('Articles commentés par une doctrine');
        expect(libelleOutil('submit_feedback')).toBe("Signalement d'erreur");
    });
    it('garde le nom brut d\'un outil inconnu', () => {
        expect(libelleOutil('nouvel_outil')).toBe('nouvel_outil');
    });
});

describe('libelleClient', () => {
    it('reconnaît les logiciels connus, sans tenir compte de la casse', () => {
        expect(libelleClient('claude-ai')).toBe('Claude');
        expect(libelleClient('Claude Desktop')).toBe('Claude');
        expect(libelleClient('openai-mcp')).toBe('ChatGPT');
        expect(libelleClient('ChatGPT')).toBe('ChatGPT');
        expect(libelleClient('cursor-vscode')).toBe('Cursor');
        expect(libelleClient('Visual Studio Code')).toBe('VS Code');
        expect(libelleClient('vscode-mcp')).toBe('VS Code');
        expect(libelleClient('mcp-remote')).toBe('Passerelle mcp-remote');
    });
    it('garde le nom brut sinon', () => {
        expect(libelleClient('inconnu')).toBe('inconnu');
        expect(libelleClient('curl/8.4.0')).toBe('curl/8.4.0');
    });
});

describe('libelleDomaine', () => {
    it('traduit les domaines de recherche', () => {
        expect(libelleDomaine('articles')).toBe('Textes');
        expect(libelleDomaine('decisions')).toBe('Jurisprudence');
        expect(libelleDomaine('doctrine')).toBe('Doctrine');
        expect(libelleDomaine('autre')).toBe('autre');
    });
});

describe('statutCle', () => {
    const now = new Date('2026-09-25T12:00:00Z');
    it('une clé révoquée reste révoquée, même expirée', () => {
        expect(statutCle(false, '2026-01-01T00:00:00Z', now)).toBe('revoquee');
        expect(statutCle(false, null, now)).toBe('revoquee');
    });
    it('une clé active dont la date est passée est expirée', () => {
        expect(statutCle(true, '2026-09-24T12:00:00Z', now)).toBe('expiree');
    });
    it('une clé active sans expiration ou non échue est active', () => {
        expect(statutCle(true, null, now)).toBe('active');
        expect(statutCle(true, '2026-10-25T12:00:00Z', now)).toBe('active');
    });
    it('chaque statut a un libellé et un badge distincts', () => {
        expect(STATUT_CLE.expiree.libelle).toBe('Expirée');
        expect(new Set(Object.values(STATUT_CLE).map(s => s.classe)).size).toBe(3);
    });
});

describe('accord', () => {
    it('met au pluriel au-delà de 1 seulement', () => {
        expect(accord(0, 'recherche', 'recherches')).toBe('0 recherche');
        expect(accord(1, 'recherche', 'recherches')).toBe('1 recherche');
        expect(accord(5, 'recherche', 'recherches')).toBe('5 recherches');
    });
});

describe('dates', () => {
    it('formate une date en JJ/MM/AAAA', () => {
        expect(formatDateFr('2026-09-24T12:00:00+00:00')).toBe('24/09/2026');
    });
    it('retombe sur le repli si la date est absente ou illisible', () => {
        expect(formatDateFr(null, 'Aucune')).toBe('Aucune');
        expect(formatDateFr('n/a', 'Jamais')).toBe('Jamais');
        expect(formatDateFr(undefined)).toBe('-');
        expect(formatDateHeureFr(null)).toBe('-');
    });
    it('formate date et heure', () => {
        expect(formatDateHeureFr('2026-09-24T12:00:00+00:00')).toMatch(/^24\/09\/2026 \d{2}:\d{2}$/);
    });
    it('dit depuis combien de jours', () => {
        const now = new Date(2026, 8, 25, 18, 0);
        expect(ilYA(new Date(2026, 8, 25, 1, 0).toISOString(), now)).toBe("aujourd'hui");
        expect(ilYA(new Date(2026, 8, 24, 23, 0).toISOString(), now)).toBe('hier');
        expect(ilYA(new Date(2026, 8, 13, 21, 0).toISOString(), now)).toBe('il y a 12 jours');
        expect(ilYA(null, now)).toBe('');
    });
    it('lit le lundi de la semaine comme texte, sans décalage de fuseau', () => {
        expect(formatSemaine('2026-06-08')).toBe('08/06');
        expect(formatSemaine('2026-06-08', true)).toBe('08/06/2026');
        expect(formatSemaine('bizarre')).toBe('bizarre');
    });
});

describe('semaineSuivie', () => {
    it('rien n\'est suivi tant que le suivi n\'a pas démarré', () => {
        expect(semaineSuivie('2026-09-22', null)).toBe(false);
    });
    it('la semaine du démarrage compte comme suivie, pas celles d\'avant', () => {
        const depuis = '2026-09-24T10:00:00+00:00';
        expect(semaineSuivie('2026-09-15', depuis)).toBe(false);
        expect(semaineSuivie('2026-09-22', depuis)).toBe(true);
        expect(semaineSuivie('2026-09-29', depuis)).toBe(true);
    });
    it('un démarrage le lundi suivant à minuit ne rend pas la semaine suivie', () => {
        expect(semaineSuivie('2026-09-15', '2026-09-22T00:00:00+00:00')).toBe(false);
        expect(semaineSuivie('2026-09-15', '2026-09-21T23:59:00+00:00')).toBe(true);
    });
    it('une date illisible n\'est pas prise pour un suivi', () => {
        expect(semaineSuivie('bizarre', '2026-09-24T10:00:00+00:00')).toBe(false);
        expect(semaineSuivie('2026-09-22', 'bizarre')).toBe(false);
    });
});

describe('preparerBarres', () => {
    const semaines = [
        { week: '2026-09-01', searches: 2, other_calls: 0 },
        { week: '2026-09-08', searches: 3, other_calls: 5 },
        { week: '2026-09-15', searches: 0, other_calls: 0 },
        { week: '2026-09-22', searches: 4, other_calls: 0, sessions: 2 },
    ];
    it('empile recherches et autres appels, hauteur relative au plus haut total', () => {
        const b = preparerBarres(semaines);
        expect(b.map(x => x.total)).toEqual([2, 8, 0, 4]);
        expect(b.map(x => x.hauteur)).toEqual([25, 100, 0, 50]);
        expect(b[1]).toMatchObject({ recherches: 3, autres: 5, libelle: '08/09' });
    });
    it('garde un maximum de 1 quand tout est à zéro', () => {
        const b = preparerBarres([{ week: '2026-09-22', searches: 0, other_calls: 0 }]);
        expect(b[0].hauteur).toBe(0);
    });
    it('sur mobile, garde un libellé sur deux en finissant par la semaine la plus récente', () => {
        expect(preparerBarres(semaines).map(x => x.libelleMobile)).toEqual([false, true, false, true]);
        expect(preparerBarres(semaines.slice(1)).map(x => x.libelleMobile)).toEqual([true, false, true]);
    });
    it('neutralise les valeurs absentes ou négatives', () => {
        const b = preparerBarres([{ week: '2026-09-22', searches: -3, other_calls: NaN }]);
        expect(b[0]).toMatchObject({ recherches: 0, autres: 0, total: 0 });
        expect(preparerBarres([])).toEqual([]);
    });
});
