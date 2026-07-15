// Données RÉELLES (snapshot prod du 15 juillet 2026) — aucun contenu juridique inventé.
// Sources : tables laws_and_codes / articles / article_versions / structure_nodes / decisions.
import { HierarchyNode, Article } from '../../src/lib/codeTree';

export const STATS = {
  decisions: 13757,
  articles: 16770,
  codes: 25,
  textes: 201,
};

export const CPC_TITLE =
  'Décret n° 64-572 du 30 juillet 1964 portant Code de Procédure civile, modifié';
export const CPC_SLUG = 'code-de-procedure-civile';

const art = (num: string, opts: Partial<Article> = {}): Article =>
  ({
    id: `art-${num}`,
    code_id: 'cpc',
    article_number: num,
    slug: `art-${num.replace(/\s/g, '-').toLowerCase()}`,
    display_order: 0,
    content_raw: '',
    status: 'validated',
    is_active: true,
    ...opts,
  } as Article);

// Pastilles réelles de la Section 5 (statuts d'abrogation conformes à la base).
const SECTION5_ARTICLES: Article[] = [
  art('44'),
  art('45'),
  art('46', { status: 'abrogé', is_active: false }),
  art('47'),
  art('48', { status: 'abrogé', is_active: false }),
  art('49', { status: 'abrogé', is_active: false }),
  art('50', { status: 'abrogé', is_active: false }),
  art('51', { status: 'abrogé', is_active: false }),
  art('52'),
  art('53', { status: 'abrogé', is_active: false }),
  art('54'),
  art('54-1', { notes: 'Créé par le décret n° 2001-1151 du 31 décembre 2001' }),
  art('54-2', { notes: 'Créé par le décret n° 2001-1151 du 31 décembre 2001' }),
  art('54-3', { notes: 'Créé par le décret n° 2001-1151 du 31 décembre 2001' }),
];

const node = (
  id: string,
  type: string,
  numero: string,
  intitule: string,
  children: HierarchyNode[] = [],
  articles: Article[] = [],
  note?: string
): HierarchyNode =>
  ({
    id,
    name: `${numero} — ${intitule}`,
    type,
    numero,
    intitule,
    note,
    articles,
    children,
  } as HierarchyNode);

// Arborescence réelle du CPC (extrait : le chemin vers l'art. 45 est complet).
export const CPC_TREE: HierarchyNode[] = [
  node('p1', 'partie', 'PREMIÈRE PARTIE', 'DE LA PROCÉDURE ORDINAIRE', [
    node('l1', 'livre', 'LIVRE PREMIER', 'DES TRIBUNAUX DÉPARTEMENTAUX', [], [
      art('1er'), art('2'), art('3'),
    ]),
    node('l2', 'livre', 'LIVRE II', 'DES TRIBUNAUX RÉGIONAUX', [
      node('t1', 'titre', 'TITRE PREMIER', 'INTRODUCTION ET INSTRUCTION DES INSTANCES', [
        node(
          's5',
          'section',
          'Section 5',
          'De la constitution d’avocat, des conclusions et de l’instruction des affaires',
          [],
          SECTION5_ARTICLES
        ),
      ]),
      node('t2', 'titre', 'TITRE II', 'DE LA COMMUNICATION AU MINISTÈRE PUBLIC'),
      node('t3', 'titre', 'TITRE III', 'DES AUDIENCES'),
      node('t4', 'titre', 'TITRE IV', 'DES JUGEMENTS'),
      node('t6b', 'titre', 'TITRE VI BIS', 'DES FINS DE NON RECEVOIR'),
    ]),
    node('l3', 'livre', 'LIVRE III', 'DE L’APPEL'),
    node('l4', 'livre', 'LIVRE IV', 'DES VOIES EXTRAORDINAIRES POUR ATTAQUER LES JUGEMENTS'),
    node('l5', 'livre', 'LIVRE V', 'DE L’EXECUTION DES JUGEMENTS'),
  ]),
  node('p2', 'partie', 'DEUXIÈME PARTIE', 'PROCÉDURES DIVERSES'),
  node('p3', 'partie', 'TROISIÈME PARTIE', 'DISPOSITIONS GÉNÉRALES'),
];

// Chemin hiérarchique de l'art. 45 (fil d'Ariane de la page article).
export const ART45_PATH = [
  { type: 'partie', badge: 'PREMIÈRE PARTIE', label: 'DE LA PROCÉDURE ORDINAIRE' },
  { type: 'livre', badge: 'LIVRE II', label: 'DES TRIBUNAUX RÉGIONAUX' },
  { type: 'titre', badge: 'TITRE PREMIER', label: 'INTRODUCTION ET INSTRUCTION DES INSTANCES' },
  {
    type: 'section',
    badge: 'Section 5',
    label: 'De la constitution d’avocat, des conclusions et de l’instruction des affaires',
  },
];

// Article 45 CPC — les 3 versions réelles.
export const ART45_V1964 = `<p class="alinea">Il est tenu au greffe de chaque tribunal un registre ou rôle général sur lequel sont inscrites, dans l’ordre de leur présentation, toutes les affaires portées devant le tribunal. Chaque inscription contient les noms des parties, ceux des avocats et le jour auquel l’affaire sera appelée.</p>
<p class="alinea"><mark class="diff-removed">Le demandeur qui entend saisir effectivement le tribunal de la demande, doit, au plus tard l’avant-veille de l’audience, déposer au greffe l’original de l’assignation.</mark></p>
<p class="alinea">Le numéro d’ordre du rôle général est communiqué aux avocats <mark class="diff-removed">constitués</mark> qui le reproduiront en tête de chacune de leurs conclusions.</p>
<p class="alinea"><mark class="diff-removed">Les affaires sont distribuées par le président entre les chambres de la manière qu’il trouve la plus convenable pour le service et l’accélération des affaires.</mark></p>`;

export const ART45_CURRENT = `<p class="alinea">Il est tenu au greffe de chaque tribunal un registre ou un rôle général sur lequel sont inscrites, dans l’ordre de leur présentation, toutes les affaires portées devant le tribunal. Chaque inscription contient les noms des parties, ceux des avocats et le jour auquel l’affaire sera appelée.</p>
<p class="alinea">Le numéro d’ordre du rôle général est communiqué aux avocats qui le reproduiront en tête de chacune de leurs conclusions.</p>
<p class="alinea"><mark class="diff-added">Le greffe tient également un rôle d’attente dans lequel sont inscrites toutes les affaires qui y sont renvoyées par le juge de la mise en état.</mark></p>`;

// Décision réelle (charte : parties personnes physiques en initiales).
export const DECISION_67 = {
  reference: 'Arrêt n° 67 du 27 novembre 2025',
  juridiction: 'Cour suprême',
  chambre: 'Chambre administrative',
  dateLongue: '27 novembre 2025',
  matiere: 'Administrative',
  motsCles: [
    'délégué du personnel',
    'autorisation de licenciement',
    'impartialité de l’administration',
    'conflit d’intérêts',
    'recours pour excès de pouvoir',
  ],
  resume:
    'La Chambre administrative de la Cour suprême statue sur les recours en annulation formés par la CBAO Groupe Attijariwafa Bank contre trois décisions du Ministre du Travail qui avaient infirmé les autorisations de licenciement de trois délégués du personnel (P. D. T., M. D. et A. S.) accordées par l’Inspecteur régional du travail de Dakar. La question de droit est de savoir si le Ministre pouvait légalement connaître du recours hiérarchique sans méconnaître l’exigence d’impartialité posée par l’article 14-1 du Pacte international relatif aux droits civils et politiques…',
  articlesCites: [
    'Article 14-1 du Pacte international relatif aux droits civils et politiques',
    'Loi organique n° 2017-09 du 17 janvier 2017 sur la Cour suprême, modifiée par la loi organique n° 2022-16 du 23 mai 2022',
    'Code du travail',
  ],
};

// Résultats affichés dans le Spotlight (scène recherche).
export const SEARCH_QUERY = 'licenciement d’un délégué du personnel';
export const SEARCH_RESULTS = [
  {
    type: 'decision' as const,
    title: 'Arrêt n° 67 du 27 novembre 2025',
    subtitle: 'Chambre administrative · Cour suprême · 2025',
  },
  {
    type: 'article' as const,
    title: 'Article L.214',
    subtitle: 'Code du travail',
  },
  {
    type: 'decision' as const,
    title: 'Ordonnance n° 14 du 30 avril 2026',
    subtitle: 'Deuxième chambre administrative · 2026',
  },
  {
    type: 'article' as const,
    title: 'Article 45',
    subtitle: 'Code de Procédure civile',
  },
];

// Article 217 du CGI (réel) : alinéas + pastille grise « circulaire d'application »
// (details.pastille forcé ouvert pour la vidéo).
export const CGI_ART217_HTML = `<p class="alinea">Le contribuable qui estime que, pour un exercice, le montant de l’acompte déjà versé est égal ou supérieur à la cotisation dont il sera finalement redevable pour cet exercice, peut se dispenser d’effectuer le versement du deuxième acompte, en remettant au comptable public compétent, au plus tard le 30 avril, une lettre datée et signée.</p>
<details class="pastille" open><summary><span class="pastille-tete">📎 Circulaire d’application n° 0000504 du 15 janvier 2016</span></summary><div class="pastille-corps"><p>La lettre doit être accompagnée des justificatifs nécessaires de l’effectivité des retenues et de leurs montants.</p><p>Si, par la suite, cette déclaration est reconnue inexacte, l’infraction est sanctionnée dans les conditions fixées aux articles <a class="article-link">665</a> à <a class="article-link">691</a> du CGI.</p></div></details>`;
