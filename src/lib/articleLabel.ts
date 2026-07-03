// Libellé d'affichage d'une entrée de code.
//
// RÈGLE : le préambule, le rapport de présentation et les visas NE SONT PAS des
// articles. On ne leur préfixe JAMAIS « Article ». Utiliser cette fonction partout
// où l'on affiche le numéro/nom d'un article, plutôt que de recomposer
// `Article ${article_number}` à la main (source récurrente du bug « Article préambule »).

export interface ArticleLabelInput {
    article_number?: string | null;
    num?: string | null;
    num_court?: string | null;
}

export function articleLabel(a: ArticleLabelInput | null | undefined): string {
    if (!a) return '';
    const an = (a.article_number ?? '').trim();

    // Sections qui ne sont pas des articles numérotés → libellé propre, sans « Article ».
    if (/^pr[ée]ambule/i.test(an)) return 'Préambule';
    if (/^rapport de pr[ée]sentation/i.test(an)) return 'Rapport de présentation';
    if (/^(expos[ée] des motifs|visas?)/i.test(an)) return a.num || a.num_court || an;

    // Article normal : le libellé prêt en base (« Article premier »…) prime.
    if (a.num) return a.num;
    if (!an) return a.num_court || '';
    if (/^(article|art\.)/i.test(an)) return an; // déjà préfixé
    return `Article ${an}`;
}
