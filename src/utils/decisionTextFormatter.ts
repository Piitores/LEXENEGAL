/**
 * LEXENEGAL - Decision Text Formatter
 * 
 * Transforme le texte brut d'une décision en HTML structuré
 * pour un rendu identique aux anciennes décisions.
 */

interface StructuredParagraph {
    type: 'visa' | 'attendu' | 'considerant' | 'dispositif' | 'normal';
    text: string;
    numero?: string;
}

/**
 * Détecte le type de paragraphe juridique
 */
function detectParagraphType(text: string): { type: StructuredParagraph['type']; numero?: string; cleanText: string } {
    const trimmed = text.trim();

    // Visa: "Vu..."
    if (/^Vu\s+/i.test(trimmed)) {
        return { type: 'visa', cleanText: trimmed };
    }

    // Considérant numéroté: "1. Considérant que..."
    const considMatch = trimmed.match(/^(\d+)\.\s*Considérant\s+(.+)/is);
    if (considMatch) {
        return { type: 'considerant', numero: considMatch[1], cleanText: `Considérant ${considMatch[2]}` };
    }

    // Considérant simple: "Considérant que..."
    if (/^Considérant\s+/i.test(trimmed)) {
        return { type: 'considerant', cleanText: trimmed };
    }

    // Attendu: "Attendu que..."
    if (/^Attendu\s+(que|qu')/i.test(trimmed)) {
        return { type: 'attendu', cleanText: trimmed };
    }

    // Dispositif: "PAR CES MOTIFS", "DECIDE", "ARRETE", "DIT ET JUGE"
    if (/^(PAR\s+CES\s+MOTIFS|D[EÉ]CIDE|ARR[EÊ]TE|DIT\s+ET\s+JUGE|STATUANT|LA\s+COUR)/i.test(trimmed)) {
        return { type: 'dispositif', cleanText: trimmed };
    }

    return { type: 'normal', cleanText: trimmed };
}

/**
 * Structure le texte brut en paragraphes typés
 */
export function structureDecisionText(texte: string): StructuredParagraph[] {
    if (!texte) return [];

    // Nettoyer le texte
    let text = texte
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u00A0/g, ' ')
        .trim();

    // Séparer "LA COUR" du premier "Vu"
    text = text.replace(
        /(LE\s+CONSEIL\s+CONSTITUTIONNEL|LA\s+COUR\s+SUPR[EÊ]ME|LA\s+COUR|LE\s+TRIBUNAL),?\s*Vu\s+/gi,
        (_, institution) => `${institution} ;\n\nVu `
    );

    // Supprimer en-têtes République
    text = text.replace(/R[ÉE]PUBL[IQU]+E\s+DU\s+S[ÉE]N[ÉE]GAL[\s\S]*?Une Foi\s*/i, '');

    // Séparer par point-virgule (séparateur juridique standard)
    const segments = text.split(/\s*;\s*/);

    const paragraphs: StructuredParagraph[] = [];

    segments.forEach((segment, index) => {
        let trimmed = segment.trim();
        if (!trimmed || trimmed.length < 3) return;

        // Remettre le point-virgule sauf pour le dernier segment
        if (index < segments.length - 1) {
            trimmed += ' ;';
        }

        const { type, numero, cleanText } = detectParagraphType(trimmed);

        paragraphs.push({
            type,
            text: cleanText,
            numero
        });
    });

    return paragraphs;
}

/**
 * Convertit les paragraphes structurés en HTML
 * avec le même style que les anciennes décisions
 */
export function decisionTextToHtml(texte: string): string {
    const paragraphs = structureDecisionText(texte);

    if (paragraphs.length === 0) {
        return '<p>Texte non disponible.</p>';
    }

    const htmlParts: string[] = [];

    paragraphs.forEach(p => {
        switch (p.type) {
            case 'visa':
                htmlParts.push(`<p class="visa"><em>${escapeHtml(p.text)}</em></p>`);
                break;

            case 'attendu':
                htmlParts.push(`<p class="attendu"><strong>Attendu</strong>${escapeHtml(p.text.replace(/^Attendu\s*/i, ''))}</p>`);
                break;

            case 'considerant':
                if (p.numero) {
                    htmlParts.push(`<p class="considerant"><span class="numero">${p.numero}.</span> <strong>Considérant</strong>${escapeHtml(p.text.replace(/^Considérant\s*/i, ''))}</p>`);
                } else {
                    htmlParts.push(`<p class="considerant"><strong>Considérant</strong>${escapeHtml(p.text.replace(/^Considérant\s*/i, ''))}</p>`);
                }
                break;

            case 'dispositif':
                htmlParts.push(`<p class="dispositif"><strong>${escapeHtml(p.text)}</strong></p>`);
                break;

            default:
                htmlParts.push(`<p>${escapeHtml(p.text)}</p>`);
        }
    });

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
 * Détecte si une décision utilise le nouveau format texte_brut
 */
export function isNewFormat(decision: any): boolean {
    // Nouvelle décision: a texte_brut mais pas texte_integral
    // ou a texte_brut et le flag encodage_propre
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
    if (isNewFormat(decision)) {
        // Nouveau format: structurer le texte brut
        return decisionTextToHtml(decision.texte_brut);
    }

    // Ancien format: retourner le HTML existant
    return decision.texte_integral || '<p>Texte intégral non disponible.</p>';
}
