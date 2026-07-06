// src/lib/pdfBlocks.ts
/**
 * Convertit le HTML (contrôlé) d'une décision en blocs typés pour le PDF.
 * PUR (pas de DOM) : tokenizer regex tolérant. Toute balise inconnue est
 * ignorée mais son TEXTE est conservé — 0 fabrication, 0 perte.
 */
export type PdfRun = { text: string; bold?: boolean; italic?: boolean };
export type BlockVariant =
    | 'normal' | 'visa' | 'centered-bold' | 'centered-italic'
    | 'dispositif' | 'heading' | 'list';
export type PdfBlock = { variant: BlockVariant; runs: PdfRun[] };

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'ul', 'ol', 'table', 'tr', 'td', 'th']);

// fromCodePoint jette sur un code point invalide → une entité malformée ne doit pas
// faire échouer toute la conversion (elle reste alors en texte littéral).
function codePoint(n: number): string | null {
    return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : null;
}

function decodeEntities(s: string): string {
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (m, n) => codePoint(parseInt(n, 16)) ?? m)
        .replace(/&#(\d+);/g, (m, n) => codePoint(Number(n)) ?? m)
        .replace(/&amp;/g, '&');
}

/** Variant portée par une balise ouvrante (null = rien de spécial → hérite du parent). */
function variantFor(tag: string, cls: string): BlockVariant | null {
    if (/(^|\s)visa(\s|$)/.test(cls)) return 'visa';
    if (/republique/.test(cls)) return 'centered-bold';
    if (/devise|decision-delibere/.test(cls)) return 'centered-italic';
    // les titres AVANT le dispositif générique (decision-dispositif-title contient « dispositif »)
    if (/section-intermediate|composition-title|dispositif-title/.test(cls)) return 'heading';
    if (/dispositif/.test(cls)) return 'dispositif';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'li') return 'list';
    return null;
}

export function htmlToPdfBlocks(html: string): PdfBlock[] {
    if (!html || !html.trim()) return [];
    const blocks: PdfBlock[] = [];
    const variantStack: BlockVariant[] = [];
    let current: PdfBlock = { variant: 'normal', runs: [] };
    let bold = 0;
    let italic = 0;

    const topVariant = () => variantStack[variantStack.length - 1] ?? 'normal';
    const flush = () => {
        if (current.runs.some((r) => r.text.trim().length > 0)) blocks.push(current);
        current = { variant: topVariant(), runs: [] };
    };

    // Les commentaires HTML sont retirés AVANT tokenisation (un « > » interne
    // couperait le commentaire en deux et ferait fuir du texte parasite).
    const tokens = html.replace(/<!--[\s\S]*?-->/g, '').match(/<[^>]*>|[^<]+/g) ?? [];
    for (const tok of tokens) {
        if (tok.startsWith('<')) {
            const m = tok.match(/^<\s*(\/?)([a-zA-Z][a-zA-Z0-9]*)/);
            if (!m) continue;
            const closing = m[1] === '/';
            const tag = m[2].toLowerCase();
            if (tag === 'b' || tag === 'strong') { bold = Math.max(0, bold + (closing ? -1 : 1)); continue; }
            if (tag === 'em' || tag === 'i') { italic = Math.max(0, italic + (closing ? -1 : 1)); continue; }
            if (tag === 'br' || tag === 'hr') { flush(); continue; }
            if (BLOCK_TAGS.has(tag)) {
                flush();
                if (!closing) {
                    const cls = (tok.match(/class\s*=\s*"([^"]*)"/) || [])[1] || '';
                    variantStack.push(variantFor(tag, cls) ?? topVariant());
                } else {
                    variantStack.pop();
                }
                current.variant = topVariant();
            }
            // balise inline inconnue (span, a, mark…) → ignorée, le texte coule.
        } else {
            const text = decodeEntities(tok).replace(/\s+/g, ' ');
            if (!text) continue;
            current.runs.push({
                text,
                ...(bold > 0 ? { bold: true } : {}),
                ...(italic > 0 ? { italic: true } : {}),
            });
        }
    }
    flush();
    return blocks;
}
