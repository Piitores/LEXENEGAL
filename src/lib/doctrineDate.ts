// Date d'une lettre de doctrine fiscale : le champ `date` est parfois absent
// mais la date figure TOUJOURS dans la référence (« … DU 18 SEPTEMBRE 2009 »)
// → repli sur la référence. Source unique, utilisée par la liste ET le détail.
const MOIS_FR: Record<string, number> = {
    janvier: 0, fevrier: 1, 'février': 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, 'août': 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, 'décembre': 11,
};

export function formatDoctrineDate(dateStr?: string | null, ref?: string | null): string {
    let d = dateStr ? new Date(dateStr) : null;
    if ((!d || isNaN(d.getTime())) && ref) {
        // Date dans la référence, après « le » ou « du ». Les extractions PDF
        // ajoutent des césures (« 200 4 », « novembr e ») → on retire TOUS les
        // espaces dans la zone date puis on découpe jour + mois + année.
        const m = ref.match(/\b(?:le|du)\s+(\d[\s\dA-Za-zÀ-ÿ]{3,40})/i);
        if (m) {
            const compact = m[1].replace(/\s+/g, '');
            const mm = compact.match(/^(\d{1,2})([A-Za-zÀ-ÿ]+?)(\d{4})/);
            if (mm) {
                const mo = MOIS_FR[mm[2].toLowerCase()];
                if (mo != null) d = new Date(Number(mm[3]), mo, Number(mm[1]));
            }
        }
    }
    if (!d || isNaN(d.getTime())) return 'Date inconnue';
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}
