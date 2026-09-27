import { describe, it, expect } from 'vitest';
import { correspond, normaliserPourRecherche, texteAffiche, texteCherchable } from '../rechercheDansLeTexte';

describe('texteAffiche', () => {
    it('retire les balises et sépare les blocs', () => {
        expect(texteAffiche('<p class="alinea">Le préavis</p><p>est dû.</p>')).toBe('Le préavis est dû.');
        expect(texteAffiche('Alinéa 1<br/>Alinéa 2')).toBe('Alinéa 1 Alinéa 2');
    });

    it('ne coupe pas un mot autour d’une balise en ligne', () => {
        expect(texteAffiche('le 1<sup>er</sup> janvier, <em>sauf</em> exception')).toBe('le 1er janvier, sauf exception');
    });

    it('décode les entités présentes dans le corpus', () => {
        expect(texteAffiche('l&#039;employeur &amp; le salarié&nbsp;: &lt;b&gt; &quot;x&quot; &#x2019;')).toBe('l\'employeur & le salarié : <b> "x" ’');
    });

    it('rend une chaîne vide pour un contenu absent', () => {
        expect(texteAffiche(null)).toBe('');
    });
});

describe('normaliserPourRecherche', () => {
    it('ignore accents, casse, ligatures et forme de l’apostrophe', () => {
        expect(normaliserPourRecherche('Préavis  ÉCRIT')).toBe('preavis ecrit');
        expect(normaliserPourRecherche('L’Œuvre')).toBe("l'oeuvre");
    });
});

describe('recherche dans un article', () => {
    const art = {
        article_number: '12',
        num: 'Article 12',
        chapter_name: 'Du contrat à durée déterminée',
        // content_raw a divergé du texte affiché (corrigé dans content_html seulement)
        content_raw: 'Le preavis est de huit jours (ancienne version)',
        content_html: '<p>Le préavis est d&#039;un mois.</p>',
    };
    const t = texteCherchable(art);

    it('trouve un mot du texte affiché, sans ses accents', () => {
        expect(correspond(t, 'preavis')).toBe(true);
        expect(correspond(t, "d'un mois")).toBe(true);
        expect(correspond(t, 'd’un mois')).toBe(true);
        expect(correspond(t, 'duree determinee')).toBe(true);
    });

    it('ne trouve pas ce qui n’est que dans content_raw', () => {
        expect(correspond(t, 'huit jours')).toBe(false);
    });

    it('cherche dans content_raw quand c’est lui qui est affiché', () => {
        expect(correspond(texteCherchable({ num: 'Article 3', content_raw: 'Délai de grâce' }), 'delai de grace')).toBe(true);
    });

    it('trouve un article par son numéro', () => {
        expect(correspond(t, 'article 12')).toBe(true);
    });

    it('une requête vide ne correspond à rien', () => {
        expect(correspond(t, '   ')).toBe(false);
    });
});
