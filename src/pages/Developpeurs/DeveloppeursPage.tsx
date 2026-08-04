import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plug, KeyRound, Terminal, Gauge, AlertCircle, Quote, ExternalLink, Sparkles } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import './DeveloppeursPage.css';

/*
 * Page développeurs (/developpeurs) — documentation publique de l'API REST
 * LEXENEGAL (api.lexenegal.sn).
 *
 * Pourquoi cette page : le document OpenAPI est destiné aux machines, il est
 * illisible pour un décideur. Or celui à qui on remet une clé n'est presque
 * jamais celui qui l'intègre : la page doit être comprise par un avocat ET
 * suffire à son développeur. D'où la progression — ce que c'est, comment
 * l'obtenir, puis le détail technique.
 *
 * ⚠️ Les valeurs affichées ici (URL, quotas, codes d'erreur) DOIVENT rester
 * alignées sur `lexenegal-mcp/src/api/` — schemas.ts pour les bornes,
 * envelope.ts pour les codes, les migrations api_key_* pour les quotas.
 */

const API_BASE = 'https://api.lexenegal.sn/v1';

/** Les opérations, groupées comme un lecteur les cherche : par intention. */
const OPERATIONS: { groupe: string; lignes: { chemin: string; quoi: string }[] }[] = [
    {
        groupe: 'Rechercher par le sens',
        lignes: [
            { chemin: 'GET /search/legislation?q=…', quoi: 'Articles de codes, lois, décrets, actes uniformes OHADA, textes CIMA. Filtres : code, base.' },
            { chemin: 'GET /search/jurisprudence?q=…', quoi: 'Décisions de justice. Filtres : juridiction, matière, période.' },
            { chemin: 'GET /search/doctrine?q=…', quoi: 'Lettres et notes de l’administration fiscale.' },
        ],
    },
    {
        groupe: 'Résoudre une référence',
        lignes: [
            { chemin: 'GET /resolve?citation=…', quoi: '« art. L.69 CT », « arrêt n°31 », « loi 2020-15 » → la pièce correspondante, ou une liste à départager.' },
        ],
    },
    {
        groupe: 'Lire une pièce',
        lignes: [
            { chemin: 'GET /codes/{code}/articles/{numéro}', quoi: 'Texte intégral de l’article en vigueur, avec sa date d’effet.' },
            { chemin: 'GET /decisions/{slug}', quoi: 'Texte intégral de la décision, métadonnées et articles cités.' },
        ],
    },
    {
        groupe: 'Suivre les liens entre textes',
        lignes: [
            { chemin: 'GET /codes/{code}/articles/{numéro}/decisions', quoi: 'Les décisions qui citent cet article.' },
            { chemin: 'GET /codes/{code}/articles/{numéro}/doctrine', quoi: 'La doctrine administrative qui l’interprète.' },
            { chemin: 'GET /codes/{code}/articles/{numéro}/annotations', quoi: 'Les annotations éditoriales (renvois, notes).' },
            { chemin: 'GET /decisions/{slug}/articles', quoi: 'Les textes que cette décision cite.' },
            { chemin: 'GET /doctrine/{slug}/articles', quoi: 'Les articles qu’une note de doctrine vise.' },
        ],
    },
    {
        groupe: 'Nous signaler une erreur',
        lignes: [
            { chemin: 'POST /feedback', quoi: 'Texte manquant, lien erroné, coquille. Seule opération d’écriture.' },
        ],
    },
];

const ERREURS: { code: string; sens: string }[] = [
    { code: '400 invalid_request', sens: 'Un paramètre est absent ou hors bornes. Le message dit lequel.' },
    { code: '401 unauthorized', sens: 'Clé absente ou inconnue.' },
    { code: '403 forbidden', sens: 'Clé révoquée ou expirée.' },
    { code: '404 not_found', sens: 'La pièce demandée n’existe pas.' },
    { code: '429 quota_exceeded', sens: 'Quota du jour atteint, ou trop de requêtes par minute. Voir l’en-tête Retry-After.' },
    { code: '500 internal', sens: 'Erreur de notre côté. Signalez-la nous.' },
];

const DeveloppeursPage: React.FC = () => {
    useEffect(() => {
        document.title = 'API pour développeurs | Lexenegal';
        return () => { document.title = 'Lexenegal'; };
    }, []);

    return (
        <div className="dev-page">
            <SEO
                title="API LEXENEGAL — brancher le droit sénégalais dans vos outils"
                description="L'API LEXENEGAL donne accès à la législation, à la jurisprudence et à la doctrine administrative du Sénégal et de l'OHADA : recherche par le sens, texte intégral et liens entre les textes."
                url="https://www.lexenegal.sn/developpeurs"
            />

            <div className="dev-page__container">
                <header className="dev-page__header">
                    <span className="dev-page__eyebrow"><Plug size={14} /> API</span>
                    <h1>Brancher LEXENEGAL dans vos outils</h1>
                    <p className="dev-page__lede">
                        L’API LEXENEGAL ouvre le fonds juridique sénégalais et OHADA — codes, lois,
                        décisions de justice, doctrine administrative — à vos propres applications :
                        logiciel métier, intranet de cabinet, assistant conversationnel.
                    </p>
                    <p className="dev-page__adresse">
                        <code>{API_BASE}</code>
                    </p>
                </header>

                {/* ── Obtenir une clé ─────────────────────────────────────── */}
                <section className="dev-section">
                    <h2><KeyRound size={20} /> Obtenir une clé</h2>
                    <p>
                        L’accès se fait par clé, délivrée au cas par cas pendant cette phase
                        d’ouverture. Écrivez-nous en indiquant qui vous êtes et ce que vous
                        souhaitez construire.
                    </p>
                    <a
                        className="dev-cta"
                        href="mailto:contact@lexenegal.sn?subject=Demande%20d%27acc%C3%A8s%20%C3%A0%20l%27API%20LEXENEGAL&body=Bonjour%2C%0A%0AJe%20souhaite%20obtenir%20une%20cl%C3%A9%20d%27acc%C3%A8s%20%C3%A0%20l%27API%20LEXENEGAL.%0A%0AStructure%20%3A%20%0AUsage%20envisag%C3%A9%20%3A%20%0AVolume%20estim%C3%A9%20%3A%20%0A%0AMerci."
                    >
                        Demander une clé
                    </a>
                    <p className="dev-note">
                        Une clé vaut mot de passe : elle ne doit jamais être publiée, ni placée
                        dans du code exécuté chez le visiteur (page web, application mobile).
                        Elle s’utilise depuis votre serveur.
                    </p>
                </section>

                {/* ── Démarrer ────────────────────────────────────────────── */}
                <section className="dev-section">
                    <h2><Terminal size={20} /> Démarrer</h2>
                    <p>
                        Chaque requête porte la clé dans un en-tête <code>Authorization</code>.
                        Voici un premier appel complet :
                    </p>
                    <pre className="dev-code">{`curl -H "Authorization: Bearer VOTRE_CLÉ" \\
  "${API_BASE}/search/legislation?q=contrat de travail"`}</pre>

                    <p>La réponse a toujours la même forme :</p>
                    <pre className="dev-code">{`{
  "data": [ … ],
  "meta": { "count": 10, "took_ms": 143, "quota_remaining": 9871 }
}`}</pre>

                    <div className="dev-encart">
                        <strong>Vous préférez cliquer plutôt qu’écrire du code ?</strong>
                        <p>
                            Importez notre fiche technique dans <em>Postman</em>, <em>Insomnia</em> ou
                            <em> Swagger Editor</em> : toutes les opérations s’affichent et s’essaient
                            directement, sans écrire une ligne.
                        </p>
                        <a className="dev-lien" href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer">
                            {API_BASE}/openapi.json <ExternalLink size={13} />
                        </a>
                    </div>
                </section>

                {/* ── ChatGPT et assistants ───────────────────────────────── */}
                <section className="dev-section dev-section--ia">
                    <h2><Sparkles size={20} /> Utiliser LEXENEGAL dans ChatGPT</h2>
                    <p>
                        Vous pouvez interroger le fonds LEXENEGAL depuis ChatGPT <strong>sans écrire
                        une ligne de code</strong>, en créant un GPT personnalisé qui utilise votre
                        clé. Comptez cinq minutes.
                    </p>
                    <ol className="dev-etapes">
                        <li>
                            Dans ChatGPT : <em>Explorer les GPT → Créer</em>, puis l’onglet{' '}
                            <em>Configurer</em>.
                        </li>
                        <li>
                            En bas, <strong>Créer une action</strong>, puis{' '}
                            <em>Importer depuis une URL</em>.
                        </li>
                        <li>
                            Collez notre fiche technique :{' '}
                            <code>{`${API_BASE}/openapi.json`}</code> — les opérations apparaissent
                            toutes seules.
                        </li>
                        <li>
                            Dans <em>Authentification</em>, choisissez <em>Clé d’API</em>, type{' '}
                            <em>Bearer</em>, et collez votre clé LEXENEGAL.
                        </li>
                        <li>
                            Enregistrez, puis essayez :{' '}
                            <em>« Que dit le droit sénégalais sur la rupture abusive du contrat de
                            travail ? »</em>
                        </li>
                    </ol>
                    <p className="dev-note">
                        Votre GPT consomme le quota de votre clé, et vous en suivez l’usage. La même
                        fiche technique fonctionne avec les autres assistants qui acceptent une
                        description OpenAPI.
                    </p>
                </section>

                {/* ── Les opérations ──────────────────────────────────────── */}
                <section className="dev-section">
                    <h2>Ce que vous pouvez faire</h2>
                    {OPERATIONS.map((g) => (
                        <div key={g.groupe} className="dev-groupe">
                            <h3>{g.groupe}</h3>
                            <dl className="dev-ops">
                                {g.lignes.map((l) => (
                                    <div key={l.chemin} className="dev-op">
                                        <dt><code>{l.chemin}</code></dt>
                                        <dd>{l.quoi}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ))}
                    <p className="dev-note">
                        Un article se désigne par son code et son numéro — le nom
                        (<code>code du travail</code>), le sigle (<code>CT</code>) ou l’identifiant
                        d’URL (<code>code-travail</code>) fonctionnent tous. Une décision se désigne
                        par l’identifiant qui figure dans son adresse sur lexenegal.sn.
                    </p>
                </section>

                {/* ── Quotas ──────────────────────────────────────────────── */}
                <section className="dev-section">
                    <h2><Gauge size={20} /> Quotas</h2>
                    <p>
                        Chaque clé dispose d’un quota journalier, remis à zéro à minuit UTC. Le solde
                        restant accompagne chaque réponse dans <code>meta.quota_remaining</code>.
                    </p>
                    <ul className="dev-liste">
                        <li><strong>Essai</strong> — 500 appels par jour, dont 50 recherches. Expire au bout de 30 jours.</li>
                        <li><strong>Standard</strong> — 10 000 appels par jour, 60 par minute.</li>
                    </ul>
                    <p className="dev-note">
                        Les recherches sont comptées à part : elles mobilisent un moteur sémantique
                        plus coûteux. Lire un article ou suivre un lien n’entame que le quota général.
                        Les résultats sont plafonnés à 25 par requête.
                    </p>
                </section>

                {/* ── Erreurs ─────────────────────────────────────────────── */}
                <section className="dev-section">
                    <h2><AlertCircle size={20} /> En cas d’erreur</h2>
                    <p>
                        Une erreur renvoie <code>{'{ "error": { "code", "message" } }'}</code>, avec un
                        message qui indique quoi corriger.
                    </p>
                    <dl className="dev-ops">
                        {ERREURS.map((e) => (
                            <div key={e.code} className="dev-op">
                                <dt><code>{e.code}</code></dt>
                                <dd>{e.sens}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="dev-note">
                        Un texte connu mais pas encore diffusé n’est pas une erreur : il répond
                        <code> 200</code> avec le statut <code>non_publie</code>. Nous préférons
                        l’annoncer plutôt que de vous laisser fabriquer un lien mort.
                    </p>
                </section>

                {/* ── Citation ────────────────────────────────────────────── */}
                <section className="dev-section dev-section--citation">
                    <h2><Quote size={20} /> Citer la source</h2>
                    <p>
                        Chaque pièce renvoyée porte une adresse <code>url</code> vers sa page publique
                        sur lexenegal.sn. Afficher ce lien à côté du contenu est la contrepartie
                        attendue de l’usage de l’API : elle permet à votre utilisateur de vérifier le
                        texte et d’en lire la version intégrale.
                    </p>
                </section>

                <footer className="dev-page__pied">
                    <p>
                        Une question, un besoin que l’API ne couvre pas encore ?{' '}
                        <a href="mailto:contact@lexenegal.sn">contact@lexenegal.sn</a> — ou{' '}
                        <Link to="/codes">parcourez le fonds</Link> pour voir ce qu’il contient.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default DeveloppeursPage;
