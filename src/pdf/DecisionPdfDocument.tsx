// src/pdf/DecisionPdfDocument.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { PdfBlock, PdfRun } from '../lib/pdfBlocks';

// Pas de césure automatique (rendu écritures juridiques : mots entiers).
Font.registerHyphenationCallback((word) => [word]);

export interface DecisionPdfData {
    reference: string;
    juridiction: string;
    chambre: string;
    dateDecision: string;   // déjà formatée fr-FR ('' si inconnue)
    matiere: string;
    resume: string;
    blocks: PdfBlock[];
    editionDate: string;    // date du jour formatée fr-FR
}

const AVERTISSEMENT =
    "Édition établie par LEXENEGAL à des fins de documentation. " +
    "Seule l'expédition délivrée par le greffe fait foi.";

const M = 42.5; // 15mm en points
// BUG react-pdf v4 : un lineHeight posé au niveau de la page empêche le rendu
// des View fixes en position absolue (pied de page). L'interligne 1.5 est donc
// porté par chaque bloc du corps, jamais par la page.
const LH = 1.5;
const styles = StyleSheet.create({
    page: {
        paddingTop: M, paddingBottom: M + 34, paddingHorizontal: M,
        fontFamily: 'Times-Roman', fontSize: 11, color: '#111111',
    },
    headerRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#047857', paddingBottom: 8, marginBottom: 18,
    },
    brand: { fontFamily: 'Times-Bold', fontSize: 16, letterSpacing: 1.5, color: '#047857' },
    brandSub: { fontSize: 8, color: '#6B7280', marginTop: 2 },
    rep: { fontFamily: 'Times-Bold', fontSize: 10, textAlign: 'right' },
    repSub: { fontFamily: 'Times-Italic', fontSize: 9, textAlign: 'right', marginTop: 2 },
    runningHeader: {
        position: 'absolute', top: 18, left: M, right: M,
        fontSize: 8, color: '#6B7280', textAlign: 'left',
    },
    title: { textAlign: 'center', marginBottom: 4, fontFamily: 'Times-Bold', fontSize: 14 },
    subtitle: { textAlign: 'center', fontSize: 11, marginBottom: 2 },
    titleBlock: { marginBottom: 16 },
    synthese: {
        backgroundColor: '#F8F9FB', borderLeftWidth: 2, borderLeftColor: '#047857',
        padding: 10, marginBottom: 18,
    },
    syntheseTitle: { fontFamily: 'Times-Bold', fontSize: 10, marginBottom: 4, color: '#047857' },
    syntheseMatiere: { fontFamily: 'Times-Bold', fontSize: 10, marginBottom: 4 },
    syntheseResume: { fontFamily: 'Times-Italic', fontSize: 10, lineHeight: 1.45 },
    footer: {
        position: 'absolute', bottom: 18, left: M, right: M,
        borderTopWidth: 0.5, borderTopColor: '#9CA3AF', paddingTop: 5,
    },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
    footerText: { fontSize: 8, color: '#6B7280' },
    disclaimer: { fontSize: 7, color: '#9CA3AF', marginTop: 3 },
    // Blocs du corps
    bNormal: { lineHeight: LH, marginBottom: 6, textAlign: 'justify' },
    bVisa: { lineHeight: LH, marginBottom: 4, fontFamily: 'Times-Italic' },
    bCenteredBold: { lineHeight: LH, marginBottom: 6, textAlign: 'center', fontFamily: 'Times-Bold' },
    bCenteredItalic: { lineHeight: LH, marginBottom: 6, textAlign: 'center', fontFamily: 'Times-Italic' },
    bDispositif: { lineHeight: LH, marginTop: 10, marginBottom: 6, fontFamily: 'Times-Bold', textAlign: 'justify' },
    bHeading: { lineHeight: LH, marginTop: 12, marginBottom: 6, fontFamily: 'Times-Bold', fontSize: 12 },
    bList: { lineHeight: LH, marginBottom: 4, marginLeft: 14, textAlign: 'justify' },
});

const BLOCK_STYLE: Record<PdfBlock['variant'], Style> = {
    normal: styles.bNormal, visa: styles.bVisa,
    'centered-bold': styles.bCenteredBold, 'centered-italic': styles.bCenteredItalic,
    dispositif: styles.bDispositif, heading: styles.bHeading, list: styles.bList,
};

// Graisse/italique de base induites par le variant du bloc : un run « plain »
// doit hériter du style du bloc (ex. dispositif en gras), pas revenir en romain.
const VARIANT_FACE: Record<PdfBlock['variant'], { bold?: boolean; italic?: boolean }> = {
    normal: {}, list: {},
    visa: { italic: true },
    'centered-bold': { bold: true },
    'centered-italic': { italic: true },
    dispositif: { bold: true },
    heading: { bold: true },
};

function runFont(r: PdfRun, variant: PdfBlock['variant']): string {
    const base = VARIANT_FACE[variant];
    const bold = r.bold || base.bold;
    const italic = r.italic || base.italic;
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
}

const DecisionPdfDocument: React.FC<{ data: DecisionPdfData }> = ({ data }) => (
    <Document
        title={`${data.juridiction} — ${data.reference}`}
        author="LEXENEGAL"
        subject={data.matiere || 'Décision de justice'}
        creator="www.lexenegal.sn"
    >
        <Page size="A4" style={styles.page}>
            {/* Rappel discret sur les pages 2+ */}
            <Text
                fixed
                style={styles.runningHeader}
                render={({ pageNumber }) => (pageNumber > 1 ? `LEXENEGAL — ${data.reference}` : '')}
            />

            {/* En-tête première page (dans le flux) */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.brand}>LEXENEGAL</Text>
                    <Text style={styles.brandSub}>Base de jurisprudence — www.lexenegal.sn</Text>
                </View>
                <View>
                    <Text style={styles.rep}>RÉPUBLIQUE DU SÉNÉGAL</Text>
                    <Text style={styles.repSub}>Au nom du Peuple Sénégalais</Text>
                </View>
            </View>

            {/* Titre */}
            <View style={styles.titleBlock}>
                <Text style={styles.title}>
                    {data.reference}{data.dateDecision ? ` du ${data.dateDecision}` : ''}
                </Text>
                {data.juridiction ? <Text style={styles.subtitle}>{data.juridiction}</Text> : null}
                {data.chambre ? <Text style={styles.subtitle}>{data.chambre}</Text> : null}
            </View>

            {/* Synthèse */}
            {(data.matiere || data.resume) ? (
                <View style={styles.synthese}>
                    <Text style={styles.syntheseTitle}>SYNTHÈSE</Text>
                    {data.matiere ? <Text style={styles.syntheseMatiere}>{data.matiere}</Text> : null}
                    {data.resume ? <Text style={styles.syntheseResume}>{data.resume}</Text> : null}
                </View>
            ) : null}

            {/* Corps */}
            {data.blocks.map((b, i) => (
                <Text key={i} style={BLOCK_STYLE[b.variant]}>
                    {b.variant === 'list' ? '•  ' : ''}
                    {b.runs.map((r, j) => (
                        <Text key={j} style={{ fontFamily: runFont(r, b.variant) }}>{r.text}</Text>
                    ))}
                </Text>
            ))}

            {/* Pied de page fixe : source + pagination ; avertissement en p.1 */}
            <View fixed style={styles.footer}>
                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>
                        {`Source : www.lexenegal.sn — édité le ${data.editionDate}`}
                    </Text>
                    <Text
                        style={styles.footerText}
                        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
                    />
                </View>
                <Text
                    style={styles.disclaimer}
                    render={({ pageNumber }) => (pageNumber === 1 ? AVERTISSEMENT : '')}
                />
            </View>
        </Page>
    </Document>
);

export default DecisionPdfDocument;
