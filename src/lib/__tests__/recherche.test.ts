import { describe, it, expect } from 'vitest';
import {
    sansAccents, contientSansAccents,
    categoriesDeBase, BASES_TEXTES,
    PASTILLES_MATIERE, valeursActives, basculerValeurs, matieresRegroupees, pucesMatiere,
    groupeDeJuridiction, construireArbreJuridictions, cleChambre, lireCleChambre,
    filtreChambres, filtreJuridictions, filtreOuChambres, libelleFacette,
    totalDecisions, formatTotal, formatTotalCourt, ajouterAuTotal, totalAParcourir,
    carteMeilleurResultat, resultatsApercu, rechercheAvecRequete,
} from '../recherche';

const fr = (n: number) => n.toLocaleString('fr-FR');

describe('texte sans accents', () => {
    it('retire accents et casse', () => {
        expect(sansAccents('Créance PRÉAVIS')).toBe('creance preavis');
        expect(sansAccents(null)).toBe('');
    });
    it('filtre local : « preavis » trouve « préavis », et inversement', () => {
        expect(contientSansAccents(['Délai de préavis'], 'preavis')).toBe(true);
        expect(contientSansAccents(['Delai de preavis'], 'PRÉAVIS')).toBe(true);
        expect(contientSansAccents([null, 'TVA'], 'créance')).toBe(false);
        expect(contientSansAccents(['x'], '  ')).toBe(true);
    });
});

describe('bases de textes (mêmes catégories que lexenegal-mcp/src/bases.ts)', () => {
    it('mappe chaque base vers ses catégories', () => {
        expect(categoriesDeBase('tous')).toBeNull();
        expect(categoriesDeBase('codes')).toEqual(['code']);
        expect(categoriesDeBase('loda')).toEqual(['loi', 'decret', 'arrete']);
        expect(categoriesDeBase('communautaire')).toEqual(['ohada', 'cima']);
        expect(categoriesDeBase('conventions')).toEqual(['convention_collective']);
    });
    it('couvre les 7 catégories présentes en base', () => {
        const toutes = BASES_TEXTES.flatMap((b) => b.categories ?? []).sort();
        expect(toutes).toEqual(['arrete', 'cima', 'code', 'convention_collective', 'decret', 'loi', 'ohada']);
    });
});

describe('pastilles de matière', () => {
    const penale = PASTILLES_MATIERE.find((p) => p.libelle === 'Pénale')!;
    const tous = PASTILLES_MATIERE.find((p) => p.libelle === 'Tous')!;
    it('« Pénale » vise Pénale ET Criminelle (arbitrage du 27/09) ; plus de pastille « Criminelle »', () => {
        expect(penale.valeurs).toEqual(['Pénale', 'Criminelle']);
        expect(PASTILLES_MATIERE.some((p) => p.libelle === 'Criminelle')).toBe(false);
    });
    it('coche et décoche le groupe entier', () => {
        const coche = basculerValeurs(penale.valeurs, ['Sociale']);
        expect(coche).toEqual(['Sociale', 'Pénale', 'Criminelle']);
        expect(valeursActives(penale.valeurs, coche)).toBe(true);
        expect(basculerValeurs(penale.valeurs, coche)).toEqual(['Sociale']);
    });
    it('un groupe à moitié coché n’est pas actif et se complète au clic', () => {
        expect(valeursActives(penale.valeurs, ['Criminelle'])).toBe(false);
        expect(basculerValeurs(penale.valeurs, ['Criminelle'])).toEqual(['Criminelle', 'Pénale']);
    });
    it('« Tous » vide la sélection et n’est actif que sans matière', () => {
        expect(basculerValeurs(tous.valeurs, ['Civile'])).toEqual([]);
        expect(valeursActives(tous.valeurs, [])).toBe(true);
        expect(valeursActives(tous.valeurs, ['Civile'])).toBe(false);
    });
    it('panneau : « Criminelle » est fondue dans « Pénale », comptes additionnés', () => {
        const liste = matieresRegroupees({ Sociale: 2524, Pénale: 2038, Criminelle: 235, Civile: 1353 });
        expect(liste.map((m) => m.libelle)).toEqual(['Sociale', 'Pénale', 'Civile']);
        expect(liste[1]).toEqual({ libelle: 'Pénale', valeurs: ['Pénale', 'Criminelle'], n: 2273 });
    });
    it('puces lisibles : un groupe entier = une puce, dans l’ordre de la sélection', () => {
        expect(pucesMatiere(['Civile', 'Criminelle', 'Pénale'])).toEqual([
            { libelle: 'Civile', valeurs: ['Civile'] },
            { libelle: 'Pénale', valeurs: ['Pénale', 'Criminelle'] },
        ]);
        expect(pucesMatiere(['Criminelle'])).toEqual([{ libelle: 'Criminelle', valeurs: ['Criminelle'] }]);
    });
    it('panneau : un membre sans sa tête de groupe reste proposé seul', () => {
        expect(matieresRegroupees({ Criminelle: 5 })).toEqual([{ libelle: 'Criminelle', valeurs: ['Criminelle'], n: 5 }]);
    });
});

describe('juridictions et chambres', () => {
    const CCJA = "Cour commune de justice et d'arbitrage (CCJA)";
    const lignes = [
        { juridiction: CCJA, chambre: 'Première chambre', n: 29 },
        { juridiction: CCJA, chambre: null, n: 1145 },
        { juridiction: 'Cour de cassation', chambre: 'Première chambre', n: 702 },
        { juridiction: 'Cour suprême', chambre: 'Première chambre', n: 23 },
        { juridiction: "Conseil d'État", chambre: '1ère Section', n: 7 },
        { juridiction: "Cour d'appel de Dakar", chambre: 'Première chambre', n: 1 },
    ];
    const arbre = construireArbreJuridictions(lignes);

    it('« Cour suprême » regroupe Cour suprême, Cour de cassation et Conseil d’État (arbitrage)', () => {
        expect(groupeDeJuridiction('Cour de cassation')).toBe('Cour Suprême');
        expect(groupeDeJuridiction("Conseil d'État")).toBe('Cour Suprême');
        expect(groupeDeJuridiction('Conseil d’État')).toBe('Cour Suprême');
        expect(groupeDeJuridiction(CCJA)).toBe('CCJA');
        expect(groupeDeJuridiction("Cour d'appel de Dakar")).toBe("Cour d'Appel");
        expect(groupeDeJuridiction(null)).toBe('Autres');
    });

    it('rattache chaque chambre aux juridictions réelles de son groupe', () => {
        expect(arbre.CCJA.total).toBe(1174);
        expect(arbre.CCJA.chambres['Première chambre']).toEqual({ n: 29, juridictions: [CCJA] });
        expect(arbre['Cour Suprême'].chambres['Première chambre']).toEqual({ n: 725, juridictions: ['Cour de cassation', 'Cour suprême'] });
    });

    it('cocher « Première chambre » sous CCJA n’envoie que le couple CCJA (29, et non 755)', () => {
        expect(filtreChambres([cleChambre('CCJA', 'Première chambre')], arbre)).toEqual([`${CCJA}::Première chambre`]);
    });

    it('sous « Cour Suprême », la chambre vaut pour chaque juridiction du groupe qui l’a', () => {
        expect(filtreChambres([cleChambre('Cour Suprême', 'Première chambre')], arbre)).toEqual([
            'Cour de cassation::Première chambre',
            'Cour suprême::Première chambre',
        ]);
    });

    it('deux groupes ne partagent plus la même case', () => {
        expect(cleChambre('CCJA', 'Première chambre')).not.toBe(cleChambre("Cour d'Appel", 'Première chambre'));
        expect(lireCleChambre(cleChambre("Cour d'Appel", 'Première chambre'))).toEqual({ groupe: "Cour d'Appel", chambre: 'Première chambre' });
    });

    it('sans sélection ou sans facettes : pas de filtre', () => {
        expect(filtreChambres([], arbre)).toBeNull();
        expect(filtreChambres([cleChambre('CCJA', 'Première chambre')], undefined)).toBeNull();
    });

    it('un groupe coché vaut toutes ses juridictions réelles', () => {
        expect(filtreJuridictions(['CCJA'], arbre)).toEqual(['CCJA', CCJA]);
        expect(filtreJuridictions([], arbre)).toBeNull();
    });

    it('expression .or() PostgREST avec guillemets échappés', () => {
        expect(filtreOuChambres([`${CCJA}::Première chambre`])).toBe(
            `and(juridiction.eq."${CCJA}",chambre.eq."Première chambre")`,
        );
        expect(filtreOuChambres(['A "b"::C\\d', 'Seule'])).toBe('and(juridiction.eq."A \\"b\\"",chambre.eq."C\\\\d"),chambre.eq."Seule"');
    });

    it('libellés lisibles : tirets simples', () => {
        expect(libelleFacette('Chambre administrative \u2014 Juge des référés')).toBe('Chambre administrative - Juge des référés');
        expect(libelleFacette('Cour_Supreme')).toBe('Cour Supreme');
    });
});

describe('total des décisions', () => {
    const P = 1000;
    it('affiche le total réel', () => {
        expect(totalDecisions({ total: 348, plafond: P, charges: 20, encore: true })).toEqual({ n: 348, plus: false });
    });
    it('au plafond : « plus de 1 000 »', () => {
        const t = totalDecisions({ total: 1000, plafond: P, charges: 20, encore: true });
        expect(formatTotal(t)).toBe(`plus de ${fr(1000)}`);
        expect(formatTotalCourt(t)).toBe(`${fr(1000)}+`);
    });
    it('comptage indisponible : ce qui est listé, « plus de » si la base a une ligne de plus', () => {
        expect(totalDecisions({ total: null, plafond: P, charges: 20, encore: true })).toEqual({ n: 20, plus: true });
        expect(totalDecisions({ total: null, plafond: P, charges: 7, encore: false })).toEqual({ n: 7, plus: false });
    });
    it('jamais moins que la liste (voisins sémantiques sans les mots)', () => {
        expect(totalDecisions({ total: 3, plafond: P, charges: 20, encore: true })).toEqual({ n: 20, plus: true });
        expect(totalDecisions({ total: 3, plafond: P, charges: 40, encore: false })).toEqual({ n: 40, plus: false });
    });
    it('additionne les autres piliers (onglet Tout)', () => {
        expect(ajouterAuTotal({ n: 1000, plus: true }, 12)).toEqual({ n: 1012, plus: true });
    });
    it('fin de la liste par pertinence plus courte que le total → invite à trier par date', () => {
        expect(totalAParcourir({ tri: 'relevance', total: 1680, plafond: P, charges: 300, encore: false })).toBe(`plus de ${fr(1000)}`);
        expect(totalAParcourir({ tri: 'relevance', total: 480, plafond: P, charges: 300, encore: false })).toBe('480');
    });
    it('pas de message tant que la liste continue, en tri par date, ou si tout est listé', () => {
        expect(totalAParcourir({ tri: 'relevance', total: 480, plafond: P, charges: 300, encore: true })).toBeNull();
        expect(totalAParcourir({ tri: 'date_desc', total: 480, plafond: P, charges: 300, encore: false })).toBeNull();
        expect(totalAParcourir({ tri: 'relevance', total: 120, plafond: P, charges: 150, encore: false })).toBeNull();
        expect(totalAParcourir({ tri: 'relevance', total: null, plafond: P, charges: 300, encore: false })).toBeNull();
    });
});

describe('carte « Meilleur résultat »', () => {
    it('article d’une convention : adresse /ccn/', () => {
        const c = carteMeilleurResultat({
            kind: 'norme', intent: 'authority',
            result: { status: 'ok', code_slug: 'ccn-banques', article_slug: 'art-12', article_number: '12', code_title: 'Convention des banques', url: '/ccn/banques/art-12' },
        });
        expect(c).toEqual({ kind: 'article', titre: 'Article 12', meta: 'Convention des banques', href: '/ccn/banques/art-12' });
    });
    it('texte cité (« loi n° 2008-41 ») : lien vers le texte', () => {
        const c = carteMeilleurResultat({
            kind: 'texte', intent: 'authority',
            result: { status: 'ok', code_slug: 'loi-2008-41-cryptologie', code_title: 'Loi n° 2008-41', url: '/code/loi-2008-41-cryptologie' },
        });
        expect(c).toEqual({ kind: 'texte', titre: 'Loi n° 2008-41', href: '/code/loi-2008-41-cryptologie' });
    });
    it('texte non publié ou inconnu : pas de carte (jamais de lien mort)', () => {
        expect(carteMeilleurResultat({ kind: 'texte', intent: 'authority', result: { status: 'non_publie', code_slug: 'x' } })).toBeNull();
        expect(carteMeilleurResultat({ kind: 'texte', intent: 'authority', result: { status: 'aucun' } })).toBeNull();
        expect(carteMeilleurResultat({ kind: null, intent: 'concept' })).toBeNull();
    });
    it('référence ambiguë : petite liste d’options (au plus 5)', () => {
        const options = Array.from({ length: 7 }, (_, i) => ({ article_slug: `art-l-${i}`, article_number: `L.${i}`, url: 'ignorée' }));
        const c = carteMeilleurResultat({ kind: 'norme', intent: 'authority', result: { status: 'desambiguisation', code_slug: 'ccn-banques', options } });
        expect(c?.kind).toBe('choix');
        if (c?.kind !== 'choix') return;
        expect(c.options).toHaveLength(5);
        expect(c.options[0]).toEqual({ libelle: 'Article L.0', href: '/ccn/banques/art-l-0' });
    });
    it('décision', () => {
        const c = carteMeilleurResultat({
            kind: 'decision', intent: 'authority',
            result: { status: 'ok', match: { slug: 'arret-n-12', reference: 'Arrêt n° 12', juridiction: 'Cour suprême', chambre: 'Chambre sociale', date_decision: '2016-04-27' } },
        });
        expect(c?.kind).toBe('decision');
        if (c?.kind !== 'decision') return;
        expect(c.href).toBe('/decision/arret-n-12');
        expect(c.meta.startsWith('Cour suprême · Chambre sociale · ')).toBe(true);
    });
});

describe('aperçu de l’accueil', () => {
    it('le texte nommé vient en premier, liens par la règle unique, abrogation signalée', () => {
        const r = resultatsApercu({
            texte: { code_slug: 'code-travail', code_title: 'Code du Travail de 1997 (abrogé)', est_abroge: true },
            decisions: [{ id: 'd1', slug: 'arret-1', reference: 'Arrêt n° 1', chambre: 'Chambre sociale', juridiction: 'Cour suprême', date_decision: '2016-04-27' }],
            articles: [
                { id: 'a1', article_slug: 'art-49', article_number: '49', code_slug: 'ccn-nettoiement-2014', code_title: 'Convention nettoiement', est_abroge: false },
                { id: 'a2', article_slug: 'art-2', article_number: '2', code_slug: null, code_title: null, est_abroge: false },
            ],
        });
        expect(r.map((x) => x.type)).toEqual(['texte', 'decision', 'article']);
        expect(r[0]).toMatchObject({ href: '/code/code-travail', estAbroge: true });
        expect(r[1]).toMatchObject({ href: '/decision/arret-1', subtitle: 'Chambre sociale · 2016' });
        expect(r[2]).toMatchObject({ href: '/ccn/nettoiement-2014/art-49', title: 'Article 49', estAbroge: false });
    });
    it('réponse vide ou absente', () => {
        expect(resultatsApercu(null)).toEqual([]);
        expect(resultatsApercu({ texte: null, decisions: [], articles: [] })).toEqual([]);
    });
});

describe('requête dans l’adresse', () => {
    it('met à jour q et garde les autres paramètres', () => {
        expect(rechercheAvecRequete('?q=ancien&x=1', 'préavis ')).toBe('?q=pr%C3%A9avis&x=1');
        expect(rechercheAvecRequete('', 'tva')).toBe('?q=tva');
    });
    it('requête vide : q retiré', () => {
        expect(rechercheAvecRequete('?q=tva', '')).toBe('');
        expect(rechercheAvecRequete('?q=tva&x=1', '  ')).toBe('?x=1');
    });
});
