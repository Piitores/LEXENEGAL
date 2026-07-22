/**
 * LEXENEGAL - Premium Decision Text Formatter
 * 
 * Transforme le texte brut d'une décision en HTML structuré premium
 * avec bloc Composition, en-tête République, et corps bien formaté
 */

interface StructuredParagraph {
    type: 'visa' | 'attendu' | 'considerant' | 'dispositif' | 'section_intermediate' | 'normal';
    text: string;
    numero?: string;
}

/**
 * Parse the COMPOSITION DE LA JURIDICTION section
 */
function parseComposition(text: string): { html: string; remainingText: string } {
    // Look for COMPOSITION DE LA JURIDICTION pattern
    const compositionMatch = text.match(
        /COMPOSITION\s+DE\s+LA\s+JURIDICTION\s*\n+([\s\S]*?)(?=\n*(?:RÉPUBLIQUE|ARRÊT|AU\s+NOM|La\s+Cour|Le\s+Tribunal|$))/i
    );

    if (!compositionMatch) {
        return { html: '', remainingText: text };
    }

    const compositionContent = compositionMatch[1];
    const remainingText = text.replace(compositionMatch[0], '').trim();

    // Parse role:name pairs (format: "Président\n:\nNom" or "Président : Nom")
    const rolePattern = /(Président|Rapporteur|Avocat\s+[gG]énéral|Greffier|Conseillers?)\s*\n*:\s*\n*([\s\S]*?)(?=\n*(?:Président|Rapporteur|Avocat|Greffier|Conseillers?|$))/gi;

    const roles: { role: string; name: string }[] = [];
    let match;

    while ((match = rolePattern.exec(compositionContent)) !== null) {
        const role = match[1].trim();
        const name = match[2].trim().replace(/\n+/g, ', ').replace(/,\s*$/, '');
        if (name) {
            roles.push({ role, name });
        }
    }

    if (roles.length === 0) {
        return { html: '', remainingText: text };
    }

    // Generate HTML
    let html = `<div class="master-composition">
    <h3 class="composition-title">COMPOSITION DE LA JURIDICTION</h3>
`;

    for (const { role, name } of roles) {
        html += `    <div class="composition-item">
        <span class="composition-role">${escapeHtml(role)}</span>
        <span class="composition-sep">:</span>
        <span class="composition-name">${escapeHtml(name)}</span>
    </div>
`;
    }

    html += `</div>`;

    return { html, remainingText };
}

/**
 * Parse and format the RÉPUBLIQUE DU SÉNÉGAL header
 */
function parseRepubliqueHeader(text: string): { html: string; remainingText: string } {
    const republiqueMatch = text.match(
        /\n*(RÉPUBLIQUE\s+DU\s+SÉNÉGAL)\s*\n+(Un\s+Peuple\s*-\s*Un\s+But\s*-\s*Une\s+Foi)\s*\n*/i
    );

    if (!republiqueMatch) {
        return { html: '', remainingText: text };
    }

    const remainingText = text.replace(republiqueMatch[0], '\n\n').trim();

    const html = `
<div class="decision-header">
    <h2 class="republique">${escapeHtml(republiqueMatch[1])}</h2>
    <p class="devise">${escapeHtml(republiqueMatch[2])}</p>
</div>
`;

    return { html, remainingText };
}

/**
 * Détecte le type de paragraphe juridique
 */
function detectParagraphType(text: string): { type: StructuredParagraph['type']; cleanText: string } {
    const trimmed = text.trim();

    // Visa: "Vu..."
    if (/^Vu\s+/i.test(trimmed)) {
        return { type: 'visa', cleanText: trimmed };
    }

    // Considérant: "Considérant que..."
    if (/^Considérant\s+/i.test(trimmed)) {
        return { type: 'considerant', cleanText: trimmed };
    }

    // Attendu: "Attendu que..."
    if (/^Attendu\s+(que|qu')/i.test(trimmed)) {
        return { type: 'attendu', cleanText: trimmed };
    }

    // Section Intermédiaire
    if (/^(EN LA FORME|AU FOND|SUR LE FOND|SUR LA COMP[EÉ]TENCE|SUR L'EXCEPTION|MOTIFS|DISCUSSION|FAITS ET PROC[EÉ]DURE)/i.test(trimmed) && trimmed.length < 100) {
        return { type: 'section_intermediate', cleanText: trimmed };
    }

    // Dispositif: "PAR CES MOTIFS", "DECIDE", etc.
    if (/^(PAR\s+CES\s+MOTIFS|D[EÉ]CIDE|ARR[EÊ]TE|DIT\s+ET\s+JUGE|STATUANT)/i.test(trimmed)) {
        return { type: 'dispositif', cleanText: trimmed };
    }

    return { type: 'normal', cleanText: trimmed };
}

/**
 * Parse decision body into structured paragraphs
 */
function parseDecisionBody(text: string): string {
    if (!text) return '';

    // Split by double newlines or semicolons followed by newline
    let segments: string[];

    if (text.includes('\n\n')) {
        segments = text.split(/\n\n+/);
    } else {
        // Fallback: split by semicolons
        segments = text.split(/;\s*/).map((s, i, arr) =>
            i < arr.length - 1 ? s.trim() + ' ;' : s.trim()
        );
    }

    const htmlParts: string[] = [];

    for (const segment of segments) {
        const trimmed = segment.trim();
        if (!trimmed || trimmed.length < 3) continue;

        const { type, cleanText } = detectParagraphType(trimmed);

        switch (type) {
            case 'visa':
                htmlParts.push(`<p class="visa"><em>${escapeHtml(cleanText)}</em></p>`);
                break;
            case 'section_intermediate':
                htmlParts.push(`<h3 class="section-intermediate">${escapeHtml(cleanText)}</h3>`);
                break;
            case 'dispositif':
                htmlParts.push(`<blockquote class="dispositif"><p>${escapeHtml(cleanText)}</p></blockquote>`);
                break;
            default:
                htmlParts.push(`<p>${escapeHtml(cleanText)}</p>`);
        }
    }

    return htmlParts.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Main function: Convert decision text to premium HTML
 */
export function decisionTextToHtml(texte: string): string {
    if (!texte) return '<p>Texte non disponible.</p>';

    let html = '';
    let text = texte.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // 1. Parse COMPOSITION DE LA JURIDICTION
    const { html: compositionHtml, remainingText: afterComposition } = parseComposition(text);
    if (compositionHtml) {
        html += compositionHtml + '\n';
        text = afterComposition;
    }

    // 2. Parse RÉPUBLIQUE DU SÉNÉGAL header
    const { html: headerHtml, remainingText: afterHeader } = parseRepubliqueHeader(text);
    if (headerHtml) {
        html += headerHtml + '\n';
        text = afterHeader;
    }

    // 3. Parse the decision body
    const bodyHtml = parseDecisionBody(text);
    html += `<div class="decision-body">\n${bodyHtml}\n</div>`;

    return html;
}

/**
 * Structure decision text for legacy compatibility
 */
export function structureDecisionText(texte: string): StructuredParagraph[] {
    if (!texte) return [];

    const text = texte.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    let segments: string[];
    if (text.includes('\n\n')) {
        segments = text.split(/\n\n+/);
    } else {
        segments = text.split(/\s*;\s*/).map((s, i, arr) =>
            i < arr.length - 1 ? s + ' ;' : s
        );
    }

    const paragraphs: StructuredParagraph[] = [];

    for (const segment of segments) {
        const trimmed = segment.trim();
        if (!trimmed || trimmed.length < 3) continue;

        const { type, cleanText } = detectParagraphType(trimmed);
        paragraphs.push({ type, text: cleanText });
    }

    return paragraphs;
}

/**
 * Détecte si une décision utilise le nouveau format texte_brut
 */
export function isNewFormat(decision: any): boolean {
    return (
        decision.texte_brut &&
        (!decision.texte_integral || decision.encodage_propre === true)
    );
}

/**
 * Obtient le contenu HTML à afficher pour une décision
 * Gère automatiquement les deux formats
 */
export function getDecisionHtml(decision: any): string {
    // If texte_integral already has proper HTML structure, return it directly
    if (decision.texte_integral && (
        decision.texte_integral.includes('class="master-composition"') ||
        decision.texte_integral.includes('class="decision-body"') ||
        decision.texte_integral.includes('<div class=')
    )) {
        return decision.texte_integral;
    }

    // Legacy: If texte_integral has plain text COMPOSITION, transform it
    if (decision.texte_integral && decision.texte_integral.includes('COMPOSITION DE LA JURIDICTION')) {
        return decisionTextToHtml(decision.texte_integral);
    }

    // Use texte_brut if available
    if (decision.texte_brut) {
        return decisionTextToHtml(decision.texte_brut);
    }

    // Fallback : texte_integral en texte brut (ni HTML structuré reconnu, ni texte_brut).
    // On le passe dans le MÊME formateur que texte_brut (découpe en paragraphes via
    // parseDecisionBody, échappement HTML) au lieu de le renvoyer tel quel - sinon le texte
    // s'affiche en un seul gros bloc non formaté dans dangerouslySetInnerHTML.
    if (decision.texte_integral) {
        return decisionTextToHtml(decision.texte_integral);
    }
    return '<p>Texte intégral non disponible.</p>';
}
