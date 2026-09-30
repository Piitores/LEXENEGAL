import { describe, it, expect } from 'vitest';
import { doitChercherParNom, fusionnerResultats, filtrerCommeLaRecherche } from '../nomUsage';

describe('nomUsage', () => {
    it('au moins deux mots et 5 caractères', () => {
        expect(doitChercherParNom('henri diédhiou')).toBe(true);
        expect(doitChercherParNom('bail')).toBe(false);
        expect(doitChercherParNom('a'.repeat(151))).toBe(false);
        expect(doitChercherParNom('  ab  c ')).toBe(false);
    });
    it('résultats par nom en tête, sans doublon, marqués', () => {
        const r = fusionnerResultats([{ id: 'b' }, { id: 'c' }] as any, [{ id: 'a' }, { id: 'b' }] as any);
        expect(r.map(x => x.id)).toEqual(['a', 'b', 'c']);
        expect(r[0].parNomUsage).toBe(true);
        expect(r[1].parNomUsage).toBe(true);
        expect(r[2].parNomUsage).toBeFalsy();
    });
    it('respecte les filtres actifs', () => {
        const f = filtrerCommeLaRecherche([{ id: 'a', chambre: 'Chambre sociale' }] as any, { chambre: ['Chambre civile et commerciale'] });
        expect(f).toEqual([]);
    });
    it('chambre au format « Juridiction::Chambre », matière non renseignée, juridictions et dates', () => {
        const d = [
            { id: 'a', juridiction: 'Cour suprême', chambre: 'Chambre sociale', matiere_principale: 'Sociale', date_decision: '2014-04-09' },
            { id: 'b', juridiction: 'Cour suprême', chambre: 'Chambre civile et commerciale', matiere_principale: null, date_decision: '2018-07-04' },
        ] as any;
        expect(filtrerCommeLaRecherche(d, { chambre: ['Cour suprême::Chambre sociale'] }).map(x => x.id)).toEqual(['a']);
        expect(filtrerCommeLaRecherche(d, { matiere: ['(non renseignée)'] }).map(x => x.id)).toEqual(['b']);
        expect(filtrerCommeLaRecherche(d, { juridiction: ['Cour d\'appel de Dakar'] })).toEqual([]);
        expect(filtrerCommeLaRecherche(d, { date_from: '2015-01-01' }).map(x => x.id)).toEqual(['b']);
        expect(filtrerCommeLaRecherche(d, { date_to: '2015-12-31' }).map(x => x.id)).toEqual(['a']);
        expect(filtrerCommeLaRecherche(d, {}).length).toBe(2);
    });
});
