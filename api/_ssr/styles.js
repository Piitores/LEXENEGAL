/*
 * Mise en forme de la VERSION SERVEUR de chaque type de page (api/render.js), injectée dans le <head> de
 * la seule page concernée (<style id="ssr-style-TYPE">), et non dans index.html : chaque bloc ne pèse que
 * sur les pages de son type. Le dossier est préfixé « _ » : Vercel n'en fait pas une fonction.
 *
 * Pourquoi (décision du propriétaire du 05/10/2026, option A) : à l'ouverture, la version serveur
 * s'affichait 1 à 2 s dans une mise en page différente, puis la page React la remplaçait (« le rendu
 * saute »). Chaque bloc reproduit donc la page React PRÊTE : mêmes marges, tailles, interlignes et
 * couleurs, relevés dans le navigateur sur la page React (getComputedStyle). Les commandes React
 * (boutons, champs, onglets) sont des emplacements vides de même taille, jamais du faux texte.
 *
 * Polices : le JEU UNIQUE de polices locales recalées (index.html : 'Lx Inter' = Arial à la chasse
 * d'Inter, 'Lx Playfair' = Georgia romain à la chasse de Playfair Display, graisse rendue par
 * -webkit-text-stroke ; 'Lx Georgia' = Georgia lui-même), exposé en variables sur #ssr-content :
 * --ssr-ui (Inter), --ssr-titre (Playfair), --ssr-texte ('Lx Georgia' : Georgia, comme --font-body de
 * React, avec la seule marge LCP), --ssr-trait-600 / --ssr-trait-700
 * (trait des titres en 600 / 700). Jamais de police web ici : elle ferait recouler le texte à son
 * arrivée. ⛔ Jamais de line-height:normal sur du texte serveur : les marges ascent/descent des
 * polices de repli (marge LCP) feraient exploser la hauteur des lignes.
 *
 * Les @font-face d'index.html, en détail (documentation déplacée ici le 05/10/2026 : un commentaire dans la
 * balise <style> d'index.html part dans CHAQUE réponse, accueil et routes sans version serveur comprises).
 * Aucune police web (elle ferait recouler le texte à son arrivée) : des polices LOCALES (local(), aucune
 * requête). Une famille introuvable est sautée (repli suivant).
 *  - 'Lx Inter' = Arial à la chasse d'Inter ; 'Lx Inter Roboto' pour Android (sans Arial) ;
 *  - 'Lx Playfair' = Georgia ROMAIN à la chasse de Playfair Display (Georgia gras est 12 à 13 % trop large) ;
 *    la graisse est rendue par un trait (-webkit-text-stroke, sans effet sur la mise en page :
 *    --ssr-trait-600 / --ssr-trait-700) ; 'Lx Playfair Noto' pour Android ;
 *  - 'Lx Georgia' = Georgia lui-même, ses quatre styles (romain, gras, italique, gras italique : jamais de
 *    graisse ou d'italique simulés), sans size-adjust : même chasse, mêmes coupures de ligne que la page
 *    React. La face n'existe que pour porter la marge LCP du texte courant (articles, décisions, doctrine).
 *    Sans Georgia (Android) : repli sur Times New Roman / serif, comme la page React.
 *  Chasse : size-adjust PAR CLASSE de caractères (unicode-range : minuscules, capitales, chiffres, espaces ;
 *  le reste sur la face sans plage), moindres carrés sur 1 787 lignes de texte réel des pages servies,
 *  vérifiés dans Chrome (05/10/2026, macOS) : écart absolu moyen de largeur 0,6 % (Inter) et 0,4 %
 *  (Playfair), contre 0,8 % et 1,3 % avec un facteur unique ; capitales seules 0,5 %. Roboto et Noto Serif :
 *  facteur unique, mesuré sur leurs versions Google Fonts, à vérifier sur appareil.
 *  Ligne de base : ascent/descent-override = métriques effectives d'Inter (0,969/0,241 em) et de Playfair
 *  Display (1,082/0,251 em), divisées par le size-adjust de chaque face ; Georgia : ses propres métriques
 *  (0,917/0,2192 em, hhea = win, identiques dans les quatre styles).
 *  MARGE LCP (technique unique) : des em ajoutés à ascent ET à descent. La ligne de base et la mise en page
 *  ne bougent pas (hauteurs de ligne toujours explicites : garde « line-height:1.5 » d'index.html, jamais de
 *  line-height:normal ici), mais la boîte de texte que mesure le LCP grandit : le bloc serveur reste le plus
 *  grand candidat après la bascule vers React (sinon le LCP mesuré par Google recule à l'heure où React est
 *  prête). Valeurs recalées le 05/10/2026 sur un LOT TIRÉ AU HASARD dans la base (46 pages de tous types hors
 *  des 11 pages de calage, plus les 6 pages où le relecteur avait vu basculer le LCP ; 1440x900 et 390x844,
 *  soit 104 vues ; Supabase retenu 3 s puis relâché), chaque essai refait sur tout le lot :
 *   - texte courant en Inter ('Lx Inter', 'Lx Inter Roboto') : +0,95 em. Une ligne ENTIÈRE de plus chez React
 *     (chapô ou paragraphe qui gagne une ligne) est couverte par construction dès que la marge atteint la
 *     moitié de l'interligne (0,875 em à 1,75, le plus grand du texte courant Inter) ; 0,95 la couvre jusqu'à
 *     un interligne de 1,9. Historique : 0,84 em, plus petite valeur sans bascule sur le lot (à 0,135, 3 vues
 *     sur 104 basculaient en 390 px ; à 0,80-0,83, le chapô du guide « créer une entreprise »), ne couvrait une
 *     ligne de plus que grâce à l'arrondi ; la relecture « rendu » du 05/10/2026 a trouvé hors lot un chapô qui
 *     gagne une ligne chez React avec 0,40 % de réserve (thème contentieux électoral en 390). Choix de 0,95 :
 *     Chrome arrondit ascent et descent SÉPARÉMENT au pixel, et une marge qui change l'écart ascent - descent
 *     décale la ligne de base d'un pixel par rapport à Inter. Mesuré (repère en ligne de base, faces de faces.py
 *     pour 400, 500 et 600-700) sur les 48 couples taille x interligne du texte serveur en Inter des premiers
 *     écrans (114 pages, 1440 et 390, 5 538 lignes) : 576 lignes décalées d'un pixel à 0,84, 914 à 0,90 (dont
 *     le corps des guides, 16,32 px / 1,75) et 38 à 0,95 (de 0,875 à 1,25 : 47 à 54 de 0,88 à 0,89, 21 à 0,965
 *     et 36 à 0,98, ces deux-là sans passe complète). Ce relevé, fait sur un élément isolé, ne voit pas les
 *     éléments en ligne à interligne propre : seule la passe complète tranche. À 0,90, 12 vues sur 126 (guides)
 *     se dégradaient de +0,8 à +2,2 points au premier écran ; à 0,95, voir Contrôles ;
 *   - texte courant en Georgia ('Lx Georgia') : +0,05 em. Sans marge, 2 vues basculaient (douanes art-194 en
 *     1440, loi cybercriminalité art-2 en 390) : même police que React, même place au demi-pixel près, et la
 *     boîte de texte React, arrondie autrement, a 1 px de plus que la serveur. Chrome arrondit ascent et descent
 *     SÉPARÉMENT au pixel : une marge qui change l'écart ascent - descent déplace la ligne de base d'un
 *     demi-pixel. 0,05 em est la plus petite valeur qui ajoute 1 px en haut et en bas sans changer cet écart
 *     au corps du texte (16,8 px), des intitulés (17,64 px) et des tableaux (15,2 px), donc sans déplacer de
 *     ligne. À 0,03, aucune bascule non plus, mais des lignes bougent de 1 px et le premier écran se dégrade
 *     (5 vues sur 104 de +0,7 à +1,1 point de pixels différents serveur/React) ;
 *   - titres ('Lx Playfair', 'Lx Playfair Noto') : +0,135 em, inchangé, sans rétrécir leur chasse : aucune
 *     bascule ne venait d'un titre, et un titre serveur plus étroit perdrait des lignes là où il est lui-même
 *     l'élément LCP (titre des décisions en 390 px, h1 de la doctrine : 9 vues sur 104).
 *  Contrôles (marge Inter 0,84, 05/10/2026) : zéro bascule sur les 104 vues du lot (la production, mesurée de
 *  la même façon : 1 bascule, procédure civile art-800 en 1440, et aucun LCP serveur sur les 6 vues de
 *  doctrine) et sur les 22 vues des pages de calage. Contrôles (marge Inter 0,95, 06/10/2026) : zéro bascule
 *  sur les 126 vues du lot et des pages de calage et sur les 102 vues du lot du relecteur « rendu » (51 pages
 *  tirées au hasard) ; premier écran (% de pixels différents serveur/React) inchangé : moyenne 3,45 -> 3,46 sur
 *  le lot et le calage (une seule vue en hausse de plus de 0,5 point : /guides en 390, +0,97, dont la
 *  description des cartes est un élément en ligne à interligne propre chez React), 3,13 -> 3,12 sur le lot du
 *  relecteur (aucune vue en hausse de plus de 0,11 point) ; réserve du chapô du thème contentieux électoral en
 *  390 : 0,79 % -> 1,57 %. ⚠️ La marge étire verticalement
 *  le fond, la bordure et le padding d'un élément « inline » : dans un bloc serveur, tout élément de texte qui
 *  porte un fond ou une bordure doit être en flex, inline-flex, inline-block ou block (c'est le cas partout).
 *  font-display:optional : si une police locale n'est pas prête à la première image (processeur lent), le
 *  texte garde la police de repli plutôt que de recouler ensuite.
 *
 * Portée : les règles visent #ssr-content (elles valent aussi avant le déplacement du contenu dans
 * #ssr-keep par src/index.tsx, sous l'écran de chargement : sans cela l'arrivée d'Inter le faisait
 * recouler, décalage compté par le CLS). #ssr-content porte la classe du type de page (ssr-type-TYPE,
 * render.js), recopiée sur #ssr-keep par src/index.tsx : « #ssr-keep.ssr-type-TYPE » met en forme le
 * cadre sans :has() (Firefox avant 121 et Safari avant 15.4 l'ignorent).
 * ⛔ AUTONOMIE DES BLOCS (05/10/2026) : les règles génériques « #ssr-keep … » d'index.html ne s'appliquent
 * plus à une page typée (#ssr-keep:where(:not([class]))). Chaque bloc porte donc lui-même ce dont il avait
 * hérité sans le dire (relevé en retirant ces règles dans le navigateur, styles calculés comparés) : couleur
 * et soulignement des liens (vert #047857, sans soulignement), grille du sommaire des articles (bloc code),
 * police des paragraphes du texte (bloc article : celle du corps, --ssr-texte ; index.html leur donnait
 * « Georgia, serif », même police partout où Georgia existe), taille et couleur de la navigation entre
 * articles (bloc article). stylesSsrApi.test.ts vérifie ces règles et la garde d'index.html : un bloc ne
 * peut plus s'appuyer sur index.html sans que ses tests le signalent.
 * Impression (Ctrl+P avant que React soit prête, ou « Chargement interrompu ») : chaque bloc a son @media
 * print, calqué sur src/styles/print.css (emplacements, colonnes et blocs que React n'imprime pas masqués,
 * badges en noir sur blanc). Chacun commence par « #ssr-content *{-webkit-text-stroke:0!important} » : le
 * trait qui simule la graisse des titres sortait DÉDOUBLÉ dans la couche texte du PDF (« GGarde arde à à
 * vue vue… » : recherche et copier-coller impossibles ; relecture « rendu » du 05/10/2026).
 *
 * ⚠️ FEUILLES REACT CHARGÉES À LA DEMANDE : la feuille d'une page React (morceau de route) arrive PENDANT la
 * phase serveur et s'applique aussi au texte serveur quand ses sélecteurs ne sont pas limités à la page React.
 * Ce qu'elle change à la géométrie du texte serveur le fait recouler (décalage compté par le CLS). Cas relevé
 * le 05/10/2026 (relecture « rendu ») : les renvois d'article (.article-link, a[data-article-id]) de
 * legal-content.css (marge intérieure 1px 5px, graisse 600, « § » en ::after) faisaient sauter le texte d'une
 * ligne 0,6 s après l'affichage (CLS 0,028 sur /code/code-penal/art-124 en 1440, 1 234 articles concernés).
 * Leur géométrie finale est donc recopiée dans les blocs article et code (legal-content.css) et dans le bloc
 * decision (DecisionPage.css : 2px 6px) ; la règle React, quand elle arrive, ne change plus que la peinture
 * (soulignement en dégradé, transitions). Le fond n'est PAS recopié : élément « inline » (cf. marge LCP).
 *
 * ⚠️ DOUBLE RENDU : chaque bloc recopie la feuille React de sa page. Toute retouche de géométrie
 * (marges, largeurs, tailles, interlignes, ordre des blocs) se reporte ici ET dans le gabarit de
 * render.js, sinon la bascule serveur -> React se remet à sauter :
 *  - article       ArticlePage.css, CodeNavTree.css, styles/legal-content.css (pages /code/:code/:article
 *                  et /ccn/:segment/:article) ;
 *  - code          CodePage.css, TextPresentation.css, CodeNavTree.css, ActionButton.css,
 *                  legal-content.css (pages /code/:slug et /ccn/:segment) ;
 *  - decision      DecisionPage.css (règles du texte de la décision recopiées dans le même ordre) ;
 *  - theme         Jurisprudence/ThemePage.css ; jurisprudence : Jurisprudence/JurisprudencePage.css ;
 *  - guides, guide GuidesPage.css ; doctrine : DoctrineDetailPage.css ; codes : CodesListPage.css.
 * Certaines largeurs d'emplacements sont relevées en px sur le texte Inter de React (boutons, onglets) :
 * elles sont à revoir si un libellé React change.
 */

export const STYLES_SSR = {
  article: `
#ssr-keep.ssr-type-article{max-width:none;margin:0;padding:0}
#ssr-content .ssr-article a{color:#047857;text-decoration:none}
#ssr-content .ssr-article{--ssr-chev:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 18 6-6-6-6'/%3E%3C/svg%3E");min-height:100vh;background:#F9FAFB;padding:100px 0 60px;color:#1A1A1A;font-family:var(--ssr-ui);font-size:16px;line-height:1.7}
#ssr-content .ssr-article,#ssr-content .ssr-article *{box-sizing:border-box}
#ssr-content .ssr-article .ssr-a-layout{display:grid;grid-template-columns:300px minmax(0,900px);grid-template-areas:"tree main";column-gap:32px;align-items:start;max-width:1280px;margin:0 auto;padding:0 24px}
#ssr-content .ssr-article .ssr-a-main{grid-area:main;min-width:0}
#ssr-content .ssr-article .ssr-a-somm{display:none}
#ssr-content .ssr-article .ssr-chev,#ssr-content .ssr-article .ssr-tt,#ssr-content .ssr-article .ssr-cc::after,#ssr-content .ssr-article .ssr-artnav a::before,#ssr-content .ssr-article .ssr-artnav a::after{-webkit-mask:var(--ssr-chev) center/contain no-repeat;mask:var(--ssr-chev) center/contain no-repeat}
#ssr-content .ssr-article .ssr-bc{display:flex;align-items:center;gap:6px;font-size:.8rem;letter-spacing:.01em;line-height:1.7;color:#9CA3AF;margin:0 0 32px}
#ssr-content .ssr-article .ssr-bc a{color:#6B7280}
#ssr-content .ssr-article .ssr-bc-cur{color:#166534;font-weight:600}
#ssr-content .ssr-article .ssr-chev{flex:0 1 13px;min-width:0;height:13px;background:currentColor}
#ssr-content .ssr-article .ssr-abrogation,#ssr-content .ssr-article .ssr-version{margin:.5rem 0 1.25rem!important;padding:.85rem 1.1rem;border-radius:8px;font-size:.95rem;line-height:1.5}
#ssr-content .ssr-article .ssr-version{position:relative;padding-left:calc(1.1rem + 25.6px)!important}
#ssr-content .ssr-article .ssr-version::before{content:"";position:absolute;left:1.1rem;top:1.05rem;width:16px;height:16px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D97706' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E")}
#ssr-content .ssr-article .ssr-abrogation{background:#fff!important;border:1px solid #E5E7EB!important;border-left:4px solid #DC2626!important;color:#991B1B!important;font-weight:500}
#ssr-content .ssr-article .ssr-abrogation a,#ssr-content .ssr-article .ssr-version a{color:inherit;font-weight:600;text-decoration:underline}
#ssr-content .ssr-article .ssr-abrogation{display:flex;gap:.6rem;align-items:flex-start}
#ssr-content .ssr-article .ssr-lab-icon{font-size:1.05rem;line-height:1.4;color:#DC2626}
#ssr-content .ssr-article .ssr-abrogation--texte{font-weight:400}
#ssr-content .ssr-article .ssr-abrogation--texte a{color:#DC2626;white-space:nowrap}
#ssr-content .ssr-article .ssr-pt{display:inline-flex;gap:2px;margin:-18px 0 28px;padding:3px;background:#F3F4F6;border:1px solid #E5E7EB;border-radius:9px}
#ssr-content .ssr-article .ssr-pt__btn{font-size:.78rem;font-weight:600;padding:6px 14px;border-radius:6px;color:#6B7280;text-decoration:none}
#ssr-content .ssr-article .ssr-pt__btn.is-actif{background:#047857;color:#fff}
#ssr-content .ssr-article .ssr-a-head{margin:0 0 32px}
#ssr-content .ssr-article .ssr-ah{display:flex;flex-direction:column;gap:.3rem;margin:0 0 1.1rem;padding-left:.9rem;border-left:2px solid #166534}
#ssr-content .ssr-article .ssr-ah-row{display:flex;align-items:center;gap:.55rem;color:#4B5563}
#ssr-content .ssr-article .ssr-ah-badge{flex-shrink:0;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;line-height:1.4;padding:2px 7px;border-radius:4px;white-space:nowrap;background:#ECFDF5;color:#047857;border:1px solid #D1FAE5}
#ssr-content .ssr-article .ssr-ah-badge--titre{background:#047857;color:#fff;border-color:#047857}
#ssr-content .ssr-article .ssr-ah-badge--chapitre{border-color:#A7F3D0}
#ssr-content .ssr-article .ssr-ah-badge--section{background:#F3F4F6;color:#6B7280;border-color:#E5E7EB}
#ssr-content .ssr-article .ssr-ah-label{font-size:.82rem;font-weight:500;line-height:1.35}
#ssr-content .ssr-article h1{font-family:var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-600) currentColor;font-size:2.5rem;font-weight:600;line-height:1.7;letter-spacing:-.02em;color:#111827;margin:0 0 16px}
#ssr-content .ssr-article .ssr-nota{display:inline-flex;vertical-align:middle;align-items:center;justify-content:center;width:1.05rem;height:1.05rem;margin-left:.5rem;border:1px solid #F59E0B;border-radius:50%;background:#FEF3C7;color:#B45309;font:800 .72rem/1 var(--ssr-ui);letter-spacing:0}
#ssr-content .ssr-article .ssr-nota::before{content:"!"}
#ssr-content .ssr-article .ssr-ver{display:flex;align-items:center;gap:8px;min-height:1.7em;margin:16px 0 0;font-size:.9rem;line-height:1.7;color:#6B7280}
#ssr-content .ssr-article .ssr-ver::before{content:"";flex:none;width:14px;height:14px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E")}
#ssr-content .ssr-article .ssr-ver-note{color:#047857;font-style:italic}
#ssr-content .ssr-article .ssr-ver--vide::after{content:"";width:min(260px,70%);height:12px;border-radius:6px;background:#EDEFF2}
#ssr-content .ssr-article .ssr-ver-wrap{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin:16px 0 0}
#ssr-content .ssr-article .ssr-ver-wrap>.ssr-ver{margin:0}
#ssr-content .ssr-article .ssr-ver-wrap>.ssr-ver--vide{flex:1 0 60%}
#ssr-content .ssr-article .ssr-modif{text-align:right;font-size:.85rem;line-height:1.7;color:#2563EB}
#ssr-content .ssr-article .ssr-modif span{text-decoration:underline}
#ssr-content .ssr-article .ssr-act{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px}
#ssr-content .ssr-article .ssr-act span{height:39.78px;width:173.28px;border:1px solid #E5E7EB;border-radius:8px;background:#fff linear-gradient(#EFF1F4,#EFF1F4) 42px 50%/55% 10px no-repeat}
#ssr-content .ssr-article .ssr-act span+span{width:226.06px}
#ssr-content .ssr-article .ssr-act span+span+span{width:187.75px;border-style:dashed;background-color:transparent}
#ssr-content .ssr-article .ssr-a-box{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:40px;margin:0 0 32px}
#ssr-content .ssr-article-body{font-family:var(--ssr-texte);font-size:1.05rem;line-height:1.8;color:#1F2937}
#ssr-content .ssr-article-body p{font-family:inherit;font-size:inherit;line-height:inherit;margin:0 0 1rem}
#ssr-content .ssr-article-body .alinea{margin:0 0 1.25rem;text-align:justify;text-indent:1.5rem;hyphens:manual;line-height:1.9}
#ssr-content .ssr-article-body .alinea:first-of-type{text-indent:0}
#ssr-content .ssr-article-body .alinea:last-child{margin-bottom:0}
#ssr-content .ssr-article-body p:is(.alinea.intitule-article,.intitule-article,.article-intitule,.article-rubrique){font-family:var(--ssr-texte);font-weight:700;font-size:1.05em;line-height:1.5;text-indent:0;text-align:left;hyphens:none;margin:0 0 1rem;padding:0 0 .6rem;border-bottom:1px solid #E5E7EB}
#ssr-content .ssr-article-body p:is(.article-intitule,.article-rubrique) strong{font-weight:inherit}
#ssr-content .ssr-article-body p:is(.alinea.intitule-article,.intitule-article,.article-intitule,.article-rubrique)+p.alinea:not(.niv1,.niv2,.niv3){text-indent:0}
#ssr-content .ssr-article-body .alinea.niv1{margin-left:1.5rem}
#ssr-content .ssr-article-body .alinea.niv2{margin-left:3rem}
#ssr-content .ssr-article-body .alinea.niv3{margin-left:4.5rem}
#ssr-content .ssr-article-body .alinea.niv4{margin-left:6rem}
#ssr-content .ssr-article-body .alinea.niv5{margin-left:7.5rem}
#ssr-content .ssr-article-body .alinea.niv6{margin-left:9rem}
#ssr-content .ssr-article-body .marqueur{font-weight:600;color:#166534;margin-right:.25rem}
#ssr-content .ssr-article-body strong{font-weight:600;color:#111827}
#ssr-content .ssr-article-body em{font-style:italic;color:#374151}
#ssr-content .ssr-article-body p:is(.nota,.nota-ohada){margin:16px 0;padding:8px 16px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;color:#B45309;font-size:.9rem;font-style:normal;line-height:1.6;text-indent:0;text-align:left}
#ssr-content .ssr-article-body p:is(.nota,.nota-ohada) em{font-style:normal;color:inherit}
#ssr-content .ssr-article-body p.alinea:is(.nota,.nota-ohada){margin:0 0 1.25rem;line-height:1.9;text-indent:1.5rem;text-align:justify}
#ssr-content .ssr-article-body p.alinea:is(.nota,.nota-ohada):first-of-type{text-indent:0}
#ssr-content .ssr-article-body p.alinea:is(.nota,.nota-ohada):last-child{margin-bottom:0}
#ssr-content .ssr-article-body .enum-dash{list-style:none;margin:1.5rem 0;padding:0 0 0 .5rem}
#ssr-content .ssr-article-body .enum-dash li{position:relative;padding-left:2rem;margin-bottom:.875rem;line-height:1.75;text-align:justify}
#ssr-content .ssr-article-body .enum-dash li::before{content:"-";position:absolute;left:0;top:0;color:#047857;font-weight:600;font-size:1.1em}
#ssr-content .ssr-article-body .ssr-version-section>h2{font-family:inherit;font-size:1rem;font-weight:600;line-height:1.7;color:#111827;margin:0 0 .75rem}
#ssr-content .ssr-article-body .ssr-version-section+.ssr-version-section{margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid #E5E7EB}
#ssr-content .ssr-article-body .abrogation-banner{background:#fff;border:1px solid #E5E7EB;border-left:4px solid #DC2626;color:#991B1B;padding:.75rem 1rem;border-radius:8px;margin:0 0 1.25rem;text-indent:0}
#ssr-content .ssr-article-body:has(.abrogation-banner) .alinea{color:#9CA3AF}
#ssr-content .ssr-article-body .pastille{margin:.9rem 0 1.1rem;border:1px solid #E5E7EB;border-left:3px solid #9CA3AF;border-radius:8px;background:#F8F9FB;text-indent:0;overflow:hidden}
#ssr-content .ssr-article-body .pastille>summary{list-style:none;padding:.55rem .85rem;font-size:.82rem;font-weight:600;color:#4B5563;display:flex;align-items:center;gap:.4rem}
#ssr-content .ssr-article-body .pastille>summary::-webkit-details-marker{display:none}
#ssr-content .ssr-article-body .pastille>summary::after{content:"\\FF0B";margin-left:auto;color:#9CA3AF;font-weight:400}
#ssr-content .ssr-article-body .art-tableau{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:.95rem;display:block;overflow-x:auto}
#ssr-content .ssr-article-body .art-tableau caption{caption-side:top;text-align:left;font-weight:600;padding:0 0 .5rem}
#ssr-content .ssr-article-body .art-tableau :is(th,td){border:1px solid #E5E7EB;padding:.5rem .75rem;text-align:left;vertical-align:top}
#ssr-content .ssr-article-body .art-tableau th{background:#F0FDF4;font-weight:600}
#ssr-content .ssr-article-body :is(.alinea-tableau,.bareme-table){width:100%;border-collapse:separate;border-spacing:0;margin:2rem 0;font-family:var(--ssr-texte);font-size:.95rem;background:linear-gradient(135deg,#FAFBFC,#fff);border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(4,120,87,.06)}
#ssr-content .ssr-article-body :is(.alinea-tableau,.bareme-table) thead{background:linear-gradient(135deg,#047857,#065F46)}
#ssr-content .ssr-article-body :is(.alinea-tableau,.bareme-table) thead th{padding:.85rem 1.25rem;font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;color:#fff;text-align:left;border:none;vertical-align:bottom}
#ssr-content .ssr-article-body .bareme-table thead th{padding:1rem 1.25rem;font-size:.85rem;vertical-align:middle}
#ssr-content .ssr-article-body .alinea-tableau caption{caption-side:top;text-align:left;font-weight:600;font-size:1rem;color:#065F46;padding-bottom:.6rem}
#ssr-content .ssr-article-body .alinea-tableau thead tr.groupes th{text-align:center;font-size:.75rem;padding-bottom:.35rem;border-bottom:1px solid rgba(255,255,255,.25)}
#ssr-content .ssr-article-body .alinea-tableau thead tr.groupes th:empty{border-bottom:none}
#ssr-content .ssr-article-body :is(.alinea-tableau,.bareme-table) td{padding:.6rem 1.25rem;border-bottom:1px solid #E5E7EB;color:#111827}
#ssr-content .ssr-article-body .bareme-table td{padding:.875rem 1.25rem}
#ssr-content .ssr-article-body .alinea-tableau :is(th,td){hyphens:manual;overflow-wrap:normal;word-break:normal}
#ssr-content .ssr-article-body .alinea-tableau:is(:has(tbody tr>td:nth-child(2):last-child),:has(tbody tr>td:nth-child(3):last-child)) :is(tbody td,thead th):first-child{min-width:15rem}
#ssr-content .ssr-article-body :is(.alinea-tableau,.bareme-table) tbody tr:last-child td{border-bottom:none}
#ssr-content .ssr-article-body .alinea-tableau :is(th,td).num{text-align:right}
#ssr-content .ssr-article-body .alinea-tableau td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
#ssr-content .ssr-article-body .alinea-tableau td[rowspan]{vertical-align:middle;text-align:left;font-weight:600;background:rgba(4,120,87,.035);border-right:1px solid #E5E7EB}
#ssr-content .ssr-article-body .alinea-tableau tr.sous-titre td{background:rgba(4,120,87,.07);font-weight:600;text-transform:uppercase;font-size:.82rem;letter-spacing:.4px;color:#065F46;border-top:1px solid rgba(4,120,87,.18)}
#ssr-content .ssr-article-body .alinea-tableau tr.total td{background:rgba(4,120,87,.05);font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-top:2px solid #047857}
#ssr-content .ssr-article-body .bareme-table tbody tr:nth-child(odd){background:rgba(4,120,87,.02)}
#ssr-content .ssr-article-body .bareme-table td:first-child{font-weight:500;color:#065F46}
#ssr-content .ssr-article-body .bareme-table td:last-child{text-align:right;font-family:'Courier New',monospace;font-size:.9rem}
#ssr-content .ssr-article .ssr-a-box.is-abroge .ssr-article-body{font-style:italic}
#ssr-content .ssr-article .ssr-a-box.is-abroge .ssr-article-body,#ssr-content .ssr-article .ssr-a-box.is-abroge .ssr-article-body *{color:#9CA3AF!important}
#ssr-content .ssr-article-body :is(.article-link,a[data-article-id]){font-weight:600;padding:1px 5px;margin:0 1px;border-radius:4px;text-decoration:none;position:relative}
#ssr-content .ssr-article-body :is(.article-link,a[data-article-id])::after{content:"§";font-size:.75em;margin-left:3px;opacity:.5;color:#047857}
#ssr-content .ssr-article .ssr-a-box.is-abroge .ssr-article-body :is(.article-link,a[data-article-id])::after{color:#9CA3AF}
#ssr-content .ssr-article .ssr-citing{margin:48px 0 0;padding:40px 0 0;border-top:1px solid #E5E7EB}
#ssr-content .ssr-article .ssr-citing h2{display:flex;align-items:center;gap:10px;font-family:var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-600) currentColor;font-size:1.35rem;font-weight:600;line-height:1.7;letter-spacing:-.02em;color:#111827;margin:0 0 24px}
#ssr-content .ssr-article .ssr-citing h2::before{content:"";flex:none;width:20px;height:20px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23047857' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m14 13-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381M16 16l6-6M21.5 10.5l-8-8M8 8l6-6M8.5 7.5l8 8'/%3E%3C/svg%3E")}
#ssr-content .ssr-article .ssr-citing ul{list-style:none;display:flex;flex-direction:column;gap:12px;margin:0;padding:0}
#ssr-content .ssr-article .ssr-cc{position:relative;padding:20px 52px 20px 76px;background:#fff;border:1px solid #E5E7EB;border-radius:14px;line-height:1.7}
#ssr-content .ssr-article .ssr-cc::before{content:"";position:absolute;left:20px;top:20px;width:40px;height:40px;border-radius:10px;background:rgba(4,120,87,.1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23047857' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v18M19 8l3 8a5 5 0 0 1-6 0zV7M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1M5 8l3 8a5 5 0 0 1-6 0zV7M7 21h10'/%3E%3C/svg%3E") center/16px no-repeat}
#ssr-content .ssr-article .ssr-cc::after{content:"";position:absolute;right:20px;top:32px;width:16px;height:16px;background:#D1D5DB}
#ssr-content .ssr-article .ssr-cc a{display:block;font-family:var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-600) currentColor;font-size:1rem;font-weight:600;line-height:1.4;letter-spacing:-.02em;color:#111827;margin:0 0 4px}
#ssr-content .ssr-article .ssr-cc-m{display:block;font-size:.8rem;color:#6B7280;margin:0 0 8px}
#ssr-content .ssr-article .ssr-cc-x{display:block;font-size:.85rem;font-style:italic;line-height:1.5;color:#9CA3AF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ssr-content .ssr-article .ssr-cc-v{align-self:flex-start;margin:-4px 0 0 20px;font-size:.85rem;line-height:1.7}
#ssr-content .ssr-article .ssr-cc-v a{color:#047857;text-decoration:underline}
#ssr-content .ssr-article .ssr-cc-vide{height:91.84px;border:1px dashed #E5E7EB;border-radius:12px;background:#fff}
#ssr-content .ssr-article p.ssr-correspondance{font-size:.85rem;line-height:1.7;color:#6B7280;margin:24px 0}
#ssr-content .ssr-article .ssr-artnav{display:flex;justify-content:space-between;align-items:stretch;gap:12px;margin:0 0 40px;padding:0 4px;font-size:.85rem;color:#6B7280}
#ssr-content .ssr-article .ssr-artnav>*{display:flex;align-items:center;gap:10px;min-width:160px;height:46px;padding:0 22px;border:1.5px solid #E5E7EB;border-radius:14px;background:linear-gradient(135deg,#fff,#FAFBFC);box-shadow:0 2px 8px rgba(0,0,0,.04);font-family:var(--ssr-texte);font-size:.92rem;font-weight:500;line-height:1.1;color:#374151}
#ssr-content .ssr-article .ssr-artnav .ssr-nav-next{justify-content:flex-end}
#ssr-content .ssr-article .ssr-artnav a::before,#ssr-content .ssr-article .ssr-artnav a::after{content:"";flex:none;width:16px;height:16px;background:#047857}
#ssr-content .ssr-article .ssr-artnav .ssr-nav-prev::after,#ssr-content .ssr-article .ssr-artnav .ssr-nav-next::before{display:none}
#ssr-content .ssr-article .ssr-artnav .ssr-nav-prev::before{transform:scaleX(-1)}
#ssr-content .ssr-article .ssr-artnav .ssr-nav--vide{opacity:.45;background:#F9FAFB;box-shadow:none}
#ssr-content .ssr-article .ssr-artnav .ssr-nav-retour{flex:1;max-width:220px;border:0;background:linear-gradient(135deg,#047857,#065F46);box-shadow:0 4px 12px rgba(4,120,87,.25)}
#ssr-content .ssr-article .ssr-a-tree{grid-area:tree;position:sticky;top:100px;max-height:calc(100vh - 130px);overflow-y:auto;background:#fff;border:1px solid #EEF0F2;border-radius:12px;padding:14px 10px}
#ssr-content .ssr-article .ssr-a-tree--vide{height:calc(100vh - 130px);background:#fff repeating-linear-gradient(#fff 0 16px,#F1F3F5 16px 30px,#fff 30px 47px) content-box}
#ssr-content .ssr-article .ssr-troot{display:flex;flex-direction:column;gap:2px}
#ssr-content .ssr-article .ssr-th{position:relative;display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:6px;font-size:.82rem;line-height:1.35;color:#111827}
#ssr-content .ssr-article .ssr-th.is-active{background:rgba(4,120,87,.08);color:#047857;font-weight:600}
#ssr-content .ssr-article .ssr-th.is-active::before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:3px;border-radius:0 3px 3px 0;background:#047857}
#ssr-content .ssr-article .ssr-tt{flex:none;width:16px;height:16px;background:#9CA3AF;-webkit-mask-size:14px;mask-size:14px}
#ssr-content .ssr-article .ssr-tt.is-open{transform:rotate(90deg)}
#ssr-content .ssr-article .ssr-tt.is-ph{visibility:hidden}
#ssr-content .ssr-article .ssr-tl{flex:1;min-width:0}
#ssr-content .ssr-article .ssr-ty{display:block;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;line-height:1;color:#9CA3AF}
#ssr-content .ssr-article .is-active .ssr-ty{color:#047857;opacity:.75}
#ssr-content .ssr-article .ssr-tm{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ssr-content .ssr-article .ssr-tnota{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:6px;border:1px solid #F59E0B;border-radius:50%;background:#FEF3C7;color:#B45309;font-size:.68rem;font-weight:800;line-height:1}
#ssr-content .ssr-article .ssr-tnota::before{content:"!"}
#ssr-content .ssr-article .ssr-tc{flex-shrink:0;padding:1px 6px;border-radius:8px;background:#F8F9FB;font-size:.65rem;font-weight:500;color:#9CA3AF}
#ssr-content .ssr-article .ssr-tc::before{content:attr(data-n)}
#ssr-content .ssr-article .ssr-td{height:2px;margin:0 8px 2px;border-radius:2px;background:#F0F1F3;overflow:hidden}
#ssr-content .ssr-article .ssr-td i{display:block;height:100%;border-radius:2px;background:#047857;opacity:.5}
#ssr-content .ssr-article .ssr-tch{padding-left:10px}
#ssr-content .ssr-article .ssr-tas{display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px 6px 30px}
#ssr-content .ssr-article .ssr-tchip{display:inline-flex;align-items:center;padding:3px 8px;border:1px solid #F0F1F3;border-radius:5px;background:#F8F9FB;font-size:.72rem;color:#6B7280}
#ssr-content .ssr-article .ssr-tchip.is-active{border-color:#047857;color:#047857;background:rgba(4,120,87,.08);font-weight:600}
#ssr-content .ssr-article .ssr-tchip.is-abroge{opacity:.55;text-decoration:line-through;color:#991B1B;border-color:#FCA5A5}
@media (max-width:1024px){#ssr-content .ssr-article::before{content:"";position:fixed;top:0;bottom:0;left:0;z-index:1001;box-shadow:2px 0 24px rgba(0,0,0,.18);pointer-events:none}#ssr-content .ssr-article .ssr-a-layout{display:block}#ssr-content .ssr-article .ssr-a-main{max-width:900px;margin:0 auto}#ssr-content .ssr-article .ssr-a-somm{display:block;width:121.13px;height:34px;margin:0 0 18px;border-radius:9px;background:#047857 linear-gradient(rgba(255,255,255,.28),rgba(255,255,255,.28)) 16px 50%/62% 9px no-repeat}#ssr-content .ssr-article .ssr-a-tree{position:static;max-width:900px;max-height:none;overflow:visible;margin:40px auto 0}#ssr-content .ssr-article .ssr-a-tree--vide{height:400px}}
@media (max-width:768px){#ssr-content .ssr-article h1{font-size:1.8rem}#ssr-content .ssr-article-body .alinea{text-indent:0;text-align:left}#ssr-content .ssr-article-body .enum-dash li{padding-left:1.5rem}#ssr-content .ssr-article .ssr-cc-vide{height:117.68px}#ssr-content .ssr-article .ssr-artnav{flex-direction:column}#ssr-content .ssr-article .ssr-artnav .ssr-nav-retour{flex:none;width:220px;height:44px}}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-article{min-height:0;padding:0;background:none}#ssr-content .ssr-article .ssr-a-layout{display:block;max-width:none;padding:0}#ssr-content .ssr-article .ssr-a-main{max-width:none}#ssr-content .ssr-article :is(.ssr-a-somm,.ssr-act,.ssr-citing,.ssr-artnav,.ssr-a-tree,.ssr-ver--vide){display:none!important}#ssr-content .ssr-article nav.ssr-bc{display:flex!important;flex-wrap:wrap;font-size:11px;color:#000}#ssr-content .ssr-article .ssr-bc :is(a,.ssr-bc-cur){color:#000!important}#ssr-content .ssr-article .ssr-bc .ssr-chev{background:currentColor!important}#ssr-content .ssr-article .ssr-ah{border-left-color:#000}#ssr-content .ssr-article .ssr-ah-badge{background:#fff!important;color:#000!important;border-color:#000!important}#ssr-content .ssr-article .ssr-ah-label{color:#000}#ssr-content .ssr-article :is(.ssr-abrogation,.ssr-article-body .abrogation-banner){border:1px solid #000!important;color:#000!important}#ssr-content .ssr-article-body .art-tableau{overflow:visible;display:table;page-break-inside:avoid}#ssr-content .ssr-article-body .alinea{page-break-inside:avoid}}
@media (max-width:640px){#ssr-content .ssr-article-body .alinea-tableau{display:block;overflow-x:auto}#ssr-content .ssr-article-body .alinea-tableau :is(thead th,td){padding:.5rem .75rem}#ssr-content .ssr-article-body .alinea-tableau td{min-width:8rem}#ssr-content .ssr-article-body .alinea-tableau:is(:has(tbody tr>td:nth-child(2):last-child),:has(tbody tr>td:nth-child(3):last-child)) :is(tbody td,thead th):first-child{min-width:9rem}}
`,
  code: `
#ssr-keep.ssr-type-code{max-width:none;margin:0;padding:0;min-height:100vh;background:#F8F9FB;}
#ssr-content .ssr-code a{color:#047857;text-decoration:none;}
#ssr-content .ssr-code{display:grid;grid-template-columns:320px 1fr;padding-top:80px;min-height:100vh;background:#F8F9FB;color:#1A1A1A;line-height:1.7;font-family:var(--ssr-ui);}
#ssr-content .ssr-code i{display:block;font-style:normal;}
#ssr-content .ssr-code :is(.ssr-st__title,.ssr-tp__label,h1,.ssr-toc h2,.ssr-dv__titre){font-family:var(--ssr-titre);font-weight:700;-webkit-text-stroke:var(--ssr-trait-700) currentColor;color:#111827;}
#ssr-content .ssr-code .ssr-st{background:#fff;border-right:1px solid #E5E7EB;position:sticky;top:80px;max-height:calc(100vh - 80px);overflow:hidden;}
#ssr-content .ssr-code .ssr-st__in{padding:20px 16px;}
#ssr-content .ssr-code .ssr-st__head{padding-bottom:16px;border-bottom:1px solid #F0F1F3;margin-bottom:16px;}
#ssr-content .ssr-code .ssr-st__sur{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#9CA3AF;margin-bottom:4px;}
#ssr-content .ssr-code .ssr-st__title{font-size:1.05rem;line-height:1.3;}
#ssr-content .ssr-code .ssr-pt{display:flex;gap:2px;margin-top:12px;background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;padding:2px;}
#ssr-content .ssr-code .ssr-pt__btn{flex:1;text-align:center;font-size:.72rem;font-weight:600;padding:6px 8px;border-radius:6px;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-pt__btn.is-actif{background:#047857;color:#fff;}
#ssr-content .ssr-code .ssr-st__search{height:33px;background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:12px;}
#ssr-content .ssr-code .ssr-st__ctl{display:flex;align-items:center;gap:12px;height:15px;margin-bottom:16px;}
#ssr-content .ssr-code .ssr-st__ctl i{width:68px;height:8px;border-radius:4px;background:rgba(4,120,87,.13);}
#ssr-content .ssr-code .ssr-st__ctl i+i{width:65px;}
#ssr-content .ssr-code .ssr-st__tree{display:flex;flex-direction:column;gap:2px;}
#ssr-content .ssr-code .ssr-st__row{position:relative;height:45.3px;border-radius:6px;background:linear-gradient(#F3F4F6,#F3F4F6) calc(100% - 8px) 12.6px/20px 16px no-repeat,linear-gradient(#F0F1F3,#F0F1F3) 8px 41.3px/calc(100% - 16px) 2px no-repeat;}
#ssr-content .ssr-code .ssr-st__row::before,#ssr-content .ssr-code .ssr-st__row::after{content:'';position:absolute;left:30px;border-radius:4px;background:#EEF0F3;}
#ssr-content .ssr-code .ssr-st__row::before{top:8px;width:64px;height:7px;}
#ssr-content .ssr-code .ssr-st__row::after{top:21px;width:58%;height:9px;background:#E7EAEE;}
#ssr-content .ssr-code .ssr-st__row.is-active{background:linear-gradient(#047857,#047857) 0 5px/3px 31.3px no-repeat,linear-gradient(rgba(4,120,87,.08),rgba(4,120,87,.08)) 0 0/100% 41.3px no-repeat,linear-gradient(#F0F1F3,#F0F1F3) 8px 41.3px/calc(100% - 16px) 2px no-repeat;}
#ssr-content .ssr-code .ssr-st__row.is-active::before,#ssr-content .ssr-code .ssr-st__row.is-active::after{background:rgba(4,120,87,.18);}
#ssr-content .ssr-code .ssr-st__chips{display:flex;flex-wrap:wrap;gap:4px;padding:4px 8px 6px 30px;margin-top:-2px;}
#ssr-content .ssr-code .ssr-st__chips i{height:27.6px;border:1px solid #F0F1F3;border-radius:5px;background:#F8F9FB;}
#ssr-content .ssr-code .ssr-st__row--sub{margin-left:10px;}
#ssr-content .ssr-code .ssr-st__row:nth-child(3n)::after{width:70%;}
#ssr-content .ssr-code .ssr-st__row:nth-child(3n+1)::after{width:47%;}
#ssr-content .ssr-code .ssr-st__foot{display:flex;justify-content:center;gap:16px;margin-top:16px;padding:14px 16px;border-top:1px solid #F0F1F3;font-size:16px;line-height:1.7;text-align:center;}
#ssr-content .ssr-code .ssr-st__foot b{display:block;font-size:1rem;font-weight:700;color:#047857;}
#ssr-content .ssr-code .ssr-st__foot small{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-code__main{display:flex;flex-direction:column;padding:32px 40px;max-width:980px;min-width:0;}
#ssr-content .ssr-code .ssr-code__main>:is(h1,.ssr-code-intro,.ssr-toc,.related-texts){order:1;}
#ssr-content .ssr-code .ssr-code__main:not(:has(>.ssr-toc))>:is(h1,.ssr-code-intro){display:none;}
#ssr-content .ssr-code .ssr-code__toggle{display:none;}
#ssr-content .ssr-code .ssr-code__abroge{display:flex;gap:.6rem;align-items:flex-start;background:#fff;border:1px solid #E5E7EB;border-left:4px solid #DC2626;color:#991B1B;padding:.85rem 1.1rem;border-radius:8px;margin:0 0 1.25rem;font-size:.95rem;line-height:1.5;}
#ssr-content .ssr-code .ssr-code__abroge>span:first-child{font-size:1.05rem;line-height:1.4;}
#ssr-content .ssr-code .ssr-code__abroge a{color:#DC2626;font-weight:600;white-space:nowrap;text-decoration:underline;}
#ssr-content .ssr-code .ssr-pa{display:flex;flex-direction:column;gap:16px;}
#ssr-content .ssr-code .ssr-pa__card{background:rgba(4,120,87,.04);border:1px solid #E5E7EB;border-left:3px solid #047857;border-radius:12px;padding:24px;}
#ssr-content .ssr-code .ssr-pa__head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;}
#ssr-content .ssr-code .ssr-pa__left{display:flex;align-items:center;gap:8px;}
#ssr-content .ssr-code .ssr-pa__chev{color:#047857;flex-shrink:0;}
#ssr-content .ssr-code .ssr-pa__num{font-size:.78rem;font-weight:600;line-height:15.1px;padding:4px 10px;border-radius:6px;background:rgba(4,120,87,.08);color:#047857;white-space:nowrap;}
#ssr-content .ssr-code .ssr-pa__card.is-abroge .ssr-pa__num{background:#F8F9FB;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-pa__abroge{font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;line-height:1.4;color:#DC2626;background:#fff;border:1px solid #DC2626;border-radius:4px;padding:1px 6px;}
#ssr-content .ssr-code .ssr-pa__copy{width:74.7px;height:24px;border:1px solid #E5E7EB;border-radius:6px;}
#ssr-content .ssr-code .ssr-tp{background:linear-gradient(180deg,#fff 0%,#F9FAFB 100%);border:1px solid #E5E7EB;border-radius:14px;padding:22px 24px;margin-bottom:24px;}
#ssr-content .ssr-code .ssr-tp__meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px;}
#ssr-content .ssr-code .ssr-tp__nature{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:linear-gradient(135deg,#047857,#10B981);padding:4px 12px;border-radius:20px;}
#ssr-content .ssr-code .ssr-tp__chip{font-size:.78rem;font-weight:600;color:#374151;background:rgba(4,120,87,.07);padding:4px 11px;border-radius:20px;}
#ssr-content .ssr-code .ssr-tp__label{font-size:1.1rem;letter-spacing:-.02em;line-height:1.7;margin:0 0 8px;}
#ssr-content .ssr-code .ssr-tp__body{font-family:var(--ssr-texte);font-size:.98rem;line-height:1.7;color:#374151;}
#ssr-content .ssr-code .ssr-tp__body p{font-size:inherit;line-height:inherit;margin:0 0 10px;}
#ssr-content .ssr-code .ssr-tp__body p:last-child{margin-bottom:0;}
#ssr-content .ssr-code p.ssr-tp__fallback{margin:0;font-size:.95rem;line-height:1.6;color:#6B7280;}
#ssr-content .ssr-code .ssr-dv__report{display:flex;justify-content:flex-end;margin-bottom:20px;}
#ssr-content .ssr-code .ssr-dv__report i{width:187.8px;height:39.8px;border:1px dashed #E5E7EB;border-radius:8px;}
#ssr-content .ssr-code .ssr-dv__bc{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:25.2px;margin-bottom:24px;font-size:.78rem;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-dv__bc i{width:150px;height:9px;margin-left:4px;border-radius:4px;background:#E7EAEE;}
#ssr-content .ssr-code .ssr-dv__pill{margin-left:auto;font-size:.68rem;font-weight:600;padding:3px 10px;border-radius:12px;background:rgba(4,120,87,.08);color:#047857;}
#ssr-content .ssr-code .ssr-dv__crumb{font-weight:600;color:#111827;padding:2px 4px;}
#ssr-content .ssr-code .ssr-dv__head{display:flow-root;margin-bottom:28px;}
#ssr-content .ssr-code h2.ssr-dv__titre{font-size:1.4rem;line-height:1.3;letter-spacing:-.02em;margin:0 0 6px;}
#ssr-content .ssr-code .ssr-dv__badge{display:inline-block;margin:6.2px 10px 0 0;padding:2px 10px;border-radius:8px;background:rgba(4,120,87,.1);color:#047857;font-size:.62em;line-height:1.3;text-transform:uppercase;letter-spacing:.04em;vertical-align:top;}
#ssr-content .ssr-code .ssr-dv__compte{font-size:.82rem;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-dv__h2{display:flex;align-items:center;gap:10px;height:29.12px;margin-bottom:6px;}
#ssr-content .ssr-code .ssr-dv__h2 i{width:90px;height:22px;border-radius:8px;background:rgba(4,120,87,.1);}
#ssr-content .ssr-code .ssr-dv__h2 i+i{width:220px;height:14px;border-radius:4px;background:#E7EAEE;}
#ssr-content .ssr-code .ssr-dv__meta{height:22.3px;background:linear-gradient(#EEF0F3,#EEF0F3) 0 6.65px/64px 9px no-repeat;}
#ssr-content .ssr-code .ssr-dv__print{width:172px;height:39.8px;margin-top:10px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;}
#ssr-content .ssr-code .ssr-dv__tabs{display:flex;height:38px;border-bottom:2px solid #F0F1F3;margin-bottom:24px;}
#ssr-content .ssr-code .ssr-dv__tabs i{width:113.5px;height:38px;border-bottom:2px solid #047857;background:linear-gradient(rgba(4,120,87,.16),rgba(4,120,87,.16)) 20px 14px/73px 9px no-repeat;}
#ssr-content .ssr-code .ssr-dv__tabs i+i{width:120px;border-bottom-color:transparent;background:linear-gradient(#EEF0F3,#EEF0F3) 20px 14px/80px 9px no-repeat;}
#ssr-content .ssr-code .ssr-dv__vide{text-align:center;padding:60px 20px;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-dv__vide svg{margin-bottom:12px;opacity:.4;}
#ssr-content .ssr-code .ssr-dv__vide p{font-size:.9rem;line-height:1.7;margin:0;}
#ssr-content .ssr-code .ssr-acs{display:flex;flex-direction:column;gap:16px;}
#ssr-content .ssr-code .ssr-ac{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:24px;}
#ssr-content .ssr-code .ssr-ac:first-child{border-left:3px solid #047857;}
#ssr-content .ssr-code .ssr-ac__head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;}
#ssr-content .ssr-code .ssr-ac__left{display:flex;align-items:center;gap:8px;}
#ssr-content .ssr-code .ssr-ac__num{font-size:.78rem;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(4,120,87,.08);color:#047857;white-space:nowrap;}
#ssr-content .ssr-code .ssr-ac__right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
#ssr-content .ssr-code .ssr-ac__date{font-size:.72rem;color:#9CA3AF;white-space:nowrap;}
#ssr-content .ssr-code .ssr-ac__copy{width:74.7px;height:24px;border:1px solid #E5E7EB;border-radius:6px;}
#ssr-content .ssr-code .ssr-ac__body{font-family:var(--ssr-texte);font-size:.88rem;line-height:1.7;color:#1F2937;white-space:pre-wrap;text-align:justify;hyphens:auto;}
#ssr-content .ssr-code .ssr-ac__body>div{white-space:normal;}
#ssr-content .ssr-code .ssr-ac__body :is(p,li,td,th){font-size:inherit;line-height:inherit;}
#ssr-content .ssr-code .ssr-ac__body p{margin:0 0 8px;text-align:justify;}
#ssr-content .ssr-code .ssr-ac__body p.alinea{margin-bottom:12px;}
#ssr-content .ssr-code .ssr-ac__body p:is(.intitule-article,.article-intitule,.article-rubrique){font-weight:700;font-size:1.05em;line-height:1.5;text-align:left;hyphens:none;margin:0 0 1rem;padding-bottom:.6rem;border-bottom:1px solid #E5E7EB;}
#ssr-content .ssr-code .ssr-ac__body ul.enum-dash{list-style:none;padding-left:20px;margin-bottom:12px;}
#ssr-content .ssr-code .ssr-ac__body ul.enum-dash li{position:relative;margin-bottom:6px;}
#ssr-content .ssr-code .ssr-ac__body ul.enum-dash li::before{content:"-";position:absolute;left:-20px;color:#6B7280;}
#ssr-content .ssr-code .ssr-ac__body :is(ul.enum-num,ol){padding-left:20px;margin-bottom:12px;}
#ssr-content .ssr-code .ssr-ac__body :is(ul.enum-num,ol) li{margin-bottom:6px;}
#ssr-content .ssr-code .ssr-ac__body .alinea.niv1{margin-left:1.4rem;}
#ssr-content .ssr-code .ssr-ac__body .alinea.niv2{margin-left:2.8rem;}
#ssr-content .ssr-code .ssr-ac__body .alinea.niv3{margin-left:4.2rem;}
#ssr-content .ssr-code .ssr-ac__body .alinea .marqueur{font-weight:600;color:#166534;margin-right:.25rem;}
#ssr-content .ssr-code .ssr-ac__body p:is(.nota,.nota-ohada){margin:16px 0;padding:8px 16px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;color:#B45309;font-size:.9rem;line-height:1.6;text-align:left;}
#ssr-content .ssr-code .ssr-ac__body p.alinea:is(.nota,.nota-ohada){margin-bottom:12px;text-align:justify;}
#ssr-content .ssr-code .ssr-ac__body :is(.art-tableau,.bareme-table,.alinea-tableau){width:100%;border-collapse:collapse;margin:1rem 0;display:block;overflow-x:auto;font-size:.95rem;}
#ssr-content .ssr-code .ssr-ac__body :is(.art-tableau,.bareme-table,.alinea-tableau) :is(th,td){border:1px solid #E5E7EB;padding:.5rem .7rem;text-align:left;vertical-align:top;}
#ssr-content .ssr-code .ssr-ac.is-abroge .ssr-ac__body,#ssr-content .ssr-code .ssr-ac.is-abroge .ssr-ac__body *{color:#9CA3AF;font-style:italic;}
#ssr-content .ssr-code .ssr-ac__body :is(.article-link,a[data-article-id]){font-weight:600;padding:1px 5px;margin:0 1px;border-radius:4px;text-decoration:none;position:relative;}
#ssr-content .ssr-code .ssr-ac__body :is(.article-link,a[data-article-id])::after{content:"§";font-size:.75em;margin-left:3px;opacity:.5;color:#047857;}
#ssr-content .ssr-code .ssr-ac.is-abroge .ssr-ac__body :is(.article-link,a[data-article-id])::after{color:#9CA3AF;}
#ssr-content .ssr-code .ssr-ac.is-abroge .ssr-ac__num{background:#F8F9FB;color:#9CA3AF;}
#ssr-content .ssr-code .ssr-ac__tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid #F0F1F3;}
#ssr-content .ssr-code .ssr-ac__tags span{font-size:.68rem;padding:2px 8px;background:#F3F4F6;color:#6B7280;border-radius:4px;}
#ssr-content .ssr-code a.ssr-ac__lien{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;margin-top:12px;font-size:.78rem;font-weight:500;color:#047857;background:rgba(4,120,87,.04);border:1px solid rgba(4,120,87,.08);border-radius:6px;}
#ssr-content .ssr-code .ssr-dv__carte{background:#fff;border:1px solid #E5E7EB;border-left:3px solid #047857;border-radius:12px;padding:24px;}
#ssr-content .ssr-code .ssr-dv__carte-tete{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
#ssr-content .ssr-code .ssr-dv__carte-tete i{width:92px;height:29.2px;border-radius:6px;background:rgba(4,120,87,.08);}
#ssr-content .ssr-code .ssr-dv__carte-tete i+i{width:74.7px;height:24px;background:none;border:1px solid #E5E7EB;}
#ssr-content .ssr-code .ssr-dv__carte>i{height:10px;margin:6.97px 0;border-radius:4px;background:#EEF0F3;}
#ssr-content .ssr-code .ssr-dv__carte>i+i{width:62%;}
#ssr-content .ssr-code .ssr-dv__carte>i.ssr-dv__carte-lien{width:171.8px;height:35.2px;margin:12px 0 0;border:1px solid rgba(4,120,87,.08);border-radius:6px;background:rgba(4,120,87,.04);}
#ssr-content .ssr-code .ssr-dv__nav{display:flex;justify-content:flex-end;margin-top:28px;padding-top:20px;border-top:1px solid #E5E7EB;}
#ssr-content .ssr-code .ssr-dv__nav i{width:340px;max-width:48%;height:59.7px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;}
#ssr-content .ssr-code .ssr-code__main>h1{font-size:1.5rem;line-height:1.3;margin:48px 0 12px;}
#ssr-content .ssr-code p.ssr-code-intro{font-size:.95rem;line-height:1.6;color:#4B5563;margin:0;}
#ssr-content .ssr-code .ssr-toc h2{font-size:1.1rem;line-height:1.4;margin:28px 0 12px;}
#ssr-content .ssr-code .ssr-toc ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 16px;font-size:.88rem;}
#ssr-content .ssr-code .related-texts{margin:2.5rem 0 1rem;padding:1.5rem;border:1px solid #E5E7EB;border-radius:14px;background:linear-gradient(180deg,#F8FAF9 0%,#fff 100%);}
#ssr-content .ssr-code .related-texts__label{font-family:inherit;font-size:1.05rem;font-weight:700;color:#166534;margin:0 0 1.1rem;}
#ssr-content .ssr-code .related-group+.related-group{margin-top:1.1rem;}
#ssr-content .ssr-code .related-group__title{font-family:inherit;font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6B7280;margin:0 0 .6rem;}
#ssr-content .ssr-code .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.6rem;}
#ssr-content .ssr-code .related-card{display:flex;flex-direction:column;gap:.35rem;padding:.7rem .85rem;border:1px solid #E5E7EB;border-radius:10px;background:#fff;}
#ssr-content .ssr-code .related-card__badge{align-self:flex-start;font-size:.66rem;font-weight:700;text-transform:uppercase;color:#166534;background:rgba(22,101,52,.08);padding:.1rem .45rem;border-radius:999px;}
#ssr-content .ssr-code .related-card__title{font-size:.86rem;line-height:1.35;color:#1F2937;}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-keep.ssr-type-code{min-height:0;}#ssr-content .ssr-code{display:block;padding:0;min-height:0;}#ssr-content .ssr-code .ssr-code__main{display:flex;max-width:none;padding:0;}#ssr-content .ssr-code .ssr-code__main>h1{order:0!important;margin:0 0 10px;}#ssr-content .ssr-code :is(.ssr-st,.ssr-code__toggle,.ssr-dv__report,.ssr-dv__print,.ssr-dv__tabs,.ssr-dv__nav,.ssr-dv__carte,.ssr-dv__h2,.ssr-dv__meta,.ssr-pa__copy,.ssr-ac__copy,a.ssr-ac__lien,.ssr-code-intro,.related-texts,.ssr-dv__bc>i){display:none!important;}#ssr-content .ssr-code .ssr-ac{border:none!important;padding-left:0;padding-right:0;page-break-inside:avoid;}#ssr-content .ssr-code :is(.ssr-tp__nature,.ssr-pa__num,.ssr-ac__num,.ssr-dv__badge){background:#fff!important;color:#000!important;border:1px solid #000;}#ssr-content .ssr-code .ssr-dv__pill{color:#047857!important;border:1px solid #047857;}}
@media (max-width:1024px){#ssr-content .ssr-code{grid-template-columns:1fr;}#ssr-content .ssr-code .ssr-st{display:none;}#ssr-content .ssr-code .ssr-code__main{padding:20px 16px;}#ssr-content .ssr-code .ssr-code__toggle{display:block;width:121.1px;height:34px;margin-bottom:18px;border-radius:9px;background:#047857;}}
@media (max-width:768px){#ssr-content .ssr-code .ssr-tp{padding:18px;}}
@media (max-width:640px){#ssr-content .ssr-code .ssr-dv__nav i{width:100%;max-width:100%;margin-top:12px;}#ssr-content .ssr-code .related-texts{padding:1.1rem;}#ssr-content .ssr-code .related-grid{grid-template-columns:1fr;}}
`,
  decision: `
#ssr-keep.ssr-type-decision{max-width:none;margin:0;padding:0}
#ssr-content .ssr-decision a{color:#047857;text-decoration:none}
#ssr-content .ssr-decision{min-height:100vh;background:linear-gradient(#FAFBFC,#FFF);font:400 16px/1.7 var(--ssr-ui);color:#1A1A1A}
#ssr-content .ssr-decision :where(h2,p){margin:0}
#ssr-content .ssr-decision :where(p){font-size:inherit;line-height:inherit}
#ssr-content .ssr-decision :where(h3,h4,h5,h6){font-family:var(--ssr-titre)}
#ssr-content .ssr-decision .ssr-dc-bc{padding:1rem 2rem;background:#FFF;border-bottom:1px solid #E5E7EB;font-size:.85rem}
#ssr-content .ssr-decision .ssr-dc-bc ol{display:flex;align-items:center;gap:.5rem;list-style:none;margin:0 auto;max-width:1400px}
#ssr-content .ssr-decision .ssr-dc-bc li{display:flex;align-items:center;gap:.5rem;color:#374151}
#ssr-content .ssr-decision .ssr-dc-bc li::after{content:'\\203A';color:#E5E7EB;font-weight:300}
#ssr-content .ssr-decision .ssr-dc-bc li:last-child::after{content:''}
#ssr-content .ssr-decision .ssr-dc-grille{display:grid;grid-template-columns:220px minmax(0,1fr) 240px;gap:2rem;max-width:1400px;margin:0 auto;padding:2rem;min-height:calc(100vh - 100px)}
#ssr-content .ssr-decision .ssr-dc-collant{position:sticky;top:2rem;display:flex;flex-direction:column;gap:.75rem}
#ssr-content .ssr-decision .ssr-dc-retour{display:block;height:41px;margin-bottom:1.5rem}
#ssr-content .ssr-decision .ssr-dc-saut{display:block;height:45.27px}
#ssr-content .ssr-decision .ssr-dc-outils-m{display:none}
#ssr-content .ssr-decision .ssr-dc-outils-d{display:flex;flex-direction:column;gap:1rem}
#ssr-content .ssr-decision .ssr-dc-rang{display:flex;gap:8px;margin-bottom:1rem}
#ssr-content .ssr-decision .ssr-dc-btn{display:block;height:38px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px}
#ssr-content .ssr-decision .ssr-dc-rang .ssr-dc-btn{flex:1}
#ssr-content .ssr-decision .ssr-dc-rang .ssr-dc-dossier{flex:0 0 101.4px}
#ssr-content .ssr-decision .ssr-dc-outils .ssr-dc-pdf{height:40px}
#ssr-content .ssr-decision .ssr-dc-main{min-width:0;background:#FFF;border-radius:16px;padding:2.5rem;box-shadow:0 4px 24px rgba(0,0,0,.04);border:1px solid #F8F9FB}
#ssr-content .ssr-decision .ssr-dc-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem 1rem;background:linear-gradient(135deg,rgba(4,120,87,.08),rgba(4,120,87,.04));color:#065F46;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-radius:20px;margin-bottom:1.5rem}
#ssr-content .ssr-decision .ssr-dc-titre{font:700 2rem/1.3 var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-700) currentColor;letter-spacing:-.02em;color:#111827;margin:0 0 .5rem}
#ssr-content .ssr-decision .ssr-dc-date{font-size:1rem;line-height:1.7;color:#374151;margin:0 0 2rem}
#ssr-content .ssr-decision .ssr-dc-synthese{background:linear-gradient(135deg,#f8faf9,#FFF);border:1px solid #E5E7EB;border-left:4px solid #047857;border-radius:12px;padding:1.5rem 2rem}
#ssr-content .ssr-decision .ssr-dc-synthese-titre{display:flex;align-items:center;font:700 .9rem/1.7 var(--ssr-texte);color:#065F46;text-transform:uppercase;letter-spacing:1px;margin:0 0 1rem}
#ssr-content .ssr-decision .ssr-dc-synthese-titre svg{margin-right:8px}
#ssr-content .ssr-decision .ssr-dc-tags{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 1.25rem;list-style:none}
#ssr-content .ssr-decision .ssr-dc-tags li{display:flex;align-items:center;padding:.35rem .85rem;background:rgba(4,120,87,.08);color:#065F46;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-radius:6px;border:1px solid rgba(4,120,87,.15)}
#ssr-content .ssr-decision .ssr-dc-tags .ssr-dc-matiere{background:#047857;color:#FFF}
#ssr-content .ssr-decision .ssr-dc-resume{font-size:1rem;font-style:italic;line-height:1.6;color:#374151;margin:0 0 1.5rem}
#ssr-content .ssr-decision .ssr-dc-refs{margin-top:1.5rem;padding-top:1rem;border-top:1px solid #E5E7EB}
#ssr-content .ssr-decision .ssr-dc-refs-titre{display:flex;align-items:center;gap:.5rem;font-size:.8rem;font-weight:700;line-height:1.7;color:#374151;text-transform:uppercase;margin:0 0 .75rem}
#ssr-content .ssr-decision .ssr-dc-refs ul{list-style:none}
#ssr-content .ssr-decision .ssr-dc-refs li{display:flex;align-items:baseline;gap:.5rem;font-family:var(--ssr-texte);font-size:.9rem;color:#111827;margin-bottom:.5rem}
#ssr-content .ssr-decision .ssr-dc-refs li span{color:#047857;font-size:.8rem}
#ssr-content .ssr-decision .ssr-dc-corps-titre{height:40px;font:600 .75rem/40px var(--ssr-ui);letter-spacing:.08em;text-transform:uppercase;color:#9CA3AF}
#ssr-content .ssr-decision .ssr-meta{list-style:none;margin:2rem 0 0;padding:1rem 1.25rem;border:1px solid #E5E7EB;border-radius:12px;font-size:.9rem;color:#374151}
#ssr-content .ssr-decision :is(.ssr-cited,.ssr-related) h2{font:700 1.1rem/1.4 var(--ssr-texte);letter-spacing:0;color:#111827;margin:2rem 0 .75rem}
#ssr-content .ssr-decision :is(.ssr-cited,.ssr-related) ul{padding-left:1.25rem;font-size:.95rem}
#ssr-content .ssr-decision .decision-header{text-align:center;margin-bottom:3rem;padding:2rem 0;border-bottom:3px double #047857}
#ssr-content .ssr-decision .republique{font-family:var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-700) currentColor;font-size:2rem;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:3px;margin-bottom:.75rem}
#ssr-content .ssr-decision .devise{font-family:var(--ssr-texte);font-size:1.1rem;font-style:italic;color:#374151;margin:0}
#ssr-content .ssr-decision .master-composition{background:linear-gradient(135deg,#f8faf9,#FFF);border:2px solid #F8F9FB;border-left:5px solid #047857;padding:2rem 2.5rem;margin:2.5rem 0 3rem;border-radius:6px;box-shadow:0 4px 16px rgba(4,120,87,.06)}
#ssr-content .ssr-decision .composition-title{font-family:var(--ssr-texte);font-size:1rem;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:2px;margin-bottom:1.75rem;padding-bottom:.875rem;border-bottom:2px solid #047857}
#ssr-content .ssr-decision .composition-item{display:grid;grid-template-columns:140px 20px 1fr;gap:.5rem;margin-bottom:1rem;line-height:1.7;align-items:baseline}
#ssr-content .ssr-decision .composition-role{font-family:var(--ssr-texte);font-weight:600;color:#065F46;font-size:.925rem;text-transform:capitalize}
#ssr-content .ssr-decision .composition-sep{color:#047857;font-weight:700}
#ssr-content .ssr-decision .composition-name{font-family:var(--ssr-texte);font-weight:400;color:#111827;font-size:.975rem}
#ssr-content .ssr-decision .master-composition p{margin:0 0 .75rem;font-family:var(--ssr-texte);font-size:.95rem;line-height:1.7;color:#111827}
#ssr-content .ssr-decision .master-composition p:last-child{margin-bottom:0}
#ssr-content .ssr-decision .master-composition p strong{color:#065F46;font-weight:600;text-transform:uppercase;font-size:.85rem;letter-spacing:.5px}
#ssr-content .ssr-decision .republique-header{text-align:center;margin:2.5rem 0 3rem;padding:2rem 0;border-top:2px solid #047857;border-bottom:2px solid #047857;background:linear-gradient(transparent,rgba(4,120,87,.03),transparent)}
#ssr-content .ssr-decision .republique-title{font-family:var(--ssr-texte);font-size:1.5rem;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:4px;margin:0 0 .75rem}
#ssr-content .ssr-decision .republique-devise{font-family:var(--ssr-texte);font-size:1.1rem;font-style:italic;color:#374151;margin:0}
#ssr-content .ssr-decision .decision-body{font-family:var(--ssr-texte);font-size:1.05rem;line-height:1.9;color:#111827;max-width:900px;margin:0 auto;padding:0 2rem}
#ssr-content .ssr-decision .decision-body p,#ssr-content .ssr-decision .decision-body .decision-para{margin:0 0 1.5rem;text-align:justify;hyphens:auto;orphans:3;widows:3}
#ssr-content .ssr-decision .decision-body .visa{border-left:4px solid #E5E7EB;padding:.75rem 1.25rem;margin:1.25rem 0;background:rgba(248,249,250,.6);font-size:.95rem;color:#374151;font-style:italic;border-radius:2px}
#ssr-content .ssr-decision .decision-body .attendu{padding-left:1.5rem;margin:1.25rem 0}
#ssr-content .ssr-decision .decision-body .dispositif{margin:2rem 0;padding:1rem 1.5rem;background:linear-gradient(135deg,rgba(4,120,87,.04),rgba(4,120,87,.08));border-left:4px solid #047857;border-radius:4px;font-weight:600;color:#111827}
#ssr-content .ssr-decision .decision-body .institution{font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:1px;margin:2rem 0 1rem}
#ssr-content .ssr-decision .decision-body .section-title{font-weight:700;color:#047857;margin:2rem 0 1rem;font-size:1.1rem;padding-bottom:.5rem}
#ssr-content .ssr-decision .section-intermediate{font-family:var(--ssr-texte);font-size:1.15rem;font-weight:700;color:#065F46;margin:2.75rem 0 1.75rem;padding-left:1.25rem;border-left:5px solid #047857;text-transform:uppercase;letter-spacing:1.5px}
#ssr-content .ssr-decision .legal-content p.visa{border-left:4px solid #E5E7EB;padding:.75rem 1.25rem;margin:1rem 0;background:rgba(248,249,250,.5);font-size:.95rem;color:#374151;font-style:italic;border-radius:2px}
#ssr-content .ssr-decision .legal-content p.attendu,#ssr-content .ssr-decision .legal-content p.considerant{text-indent:0;padding-left:1.5rem;margin:1rem 0;line-height:1.8}
#ssr-content .ssr-decision .legal-content p.attendu strong,#ssr-content .ssr-decision .legal-content p.considerant strong{font-weight:700;color:#065F46}
#ssr-content .ssr-decision .legal-content p.dispositif{margin-top:2rem;padding:1rem 1.5rem;background:linear-gradient(135deg,rgba(4,120,87,.03),rgba(4,120,87,.08));border-left:4px solid #047857;border-radius:4px;font-weight:600;color:#111827}
@media (max-width:768px){#ssr-content .ssr-decision .decision-body{font-size:1rem;padding:0 1.25rem;line-height:1.75}#ssr-content .ssr-decision .republique{font-size:1.5rem;letter-spacing:1.5px}#ssr-content .ssr-decision .section-intermediate{font-size:1.05rem}#ssr-content .ssr-decision .master-composition{padding:1.5rem 1.25rem}#ssr-content .ssr-decision .composition-item{grid-template-columns:110px 15px 1fr;gap:.35rem}#ssr-content .ssr-decision .composition-role{font-size:.85rem}#ssr-content .ssr-decision .composition-name{font-size:.9rem}}
#ssr-content .ssr-decision .legal-content-wrapper{position:relative;overflow:hidden}
#ssr-content .ssr-decision .legal-content{position:relative;z-index:1}
#ssr-content .ssr-decision .legal-content a{color:inherit}
#ssr-content .ssr-decision .legal-content :is(.article-link,a[data-article-id]){color:#047857;font-weight:600;padding:2px 6px;margin:0 1px;border-radius:4px;text-decoration:none;position:relative}
#ssr-content .ssr-decision .legal-content :is(.article-link,a[data-article-id])::after{content:"§";font-size:.75em;margin-left:3px;opacity:.5;color:#047857}
#ssr-content .ssr-decision .legal-content p{margin:1.25rem 0;line-height:1.9;text-align:justify;text-indent:1.5rem;font-size:1rem;color:#111827;letter-spacing:.01em}
#ssr-content .ssr-decision .legal-content p:first-of-type{text-indent:0}
#ssr-content .ssr-decision .legal-content p.visa+p:not(.visa){margin-top:2rem}
#ssr-content .ssr-decision .legal-content p.dispositif{margin-top:2.5rem!important}
#ssr-content .ssr-decision .legal-content>div>p{margin-bottom:1.5rem}
#ssr-content .ssr-decision .legal-content .bareme-table{display:block;max-width:100%;overflow:hidden;margin:1.5rem 0;font-family:var(--ssr-texte);font-size:.95rem}
@media (max-width:1200px){#ssr-content .ssr-decision .ssr-dc-grille{grid-template-columns:minmax(0,1fr);padding:1rem}#ssr-content .ssr-decision .ssr-dc-gauche,#ssr-content .ssr-decision .ssr-dc-droite{display:none}#ssr-content .ssr-decision .ssr-dc-main{padding:1.5rem}#ssr-content .ssr-decision .ssr-dc-outils-m{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:1.25rem 0 1.5rem}#ssr-content .ssr-decision .ssr-dc-outils-m>.ssr-dc-rang,#ssr-content .ssr-decision .ssr-dc-outils-m>.ssr-dc-pdf{grid-column:1/-1}}
@media (max-width:768px){#ssr-content .ssr-decision .ssr-dc-titre{font-size:1.5rem}#ssr-content .ssr-decision .ssr-dc-bc{padding:.75rem 1rem;font-size:.75rem}#ssr-content .ssr-decision .ssr-dc-synthese{padding:1rem 1.25rem}}
@media (max-width:480px){#ssr-content .ssr-decision .ssr-dc-outils-m{gap:.5rem}#ssr-content .ssr-decision .ssr-dc-outils-m .ssr-dc-btn{height:37.2px}#ssr-content .ssr-decision .ssr-dc-outils-m .ssr-dc-pdf{height:39.2px}#ssr-content .ssr-decision .ssr-dc-outils-m .ssr-dc-dossier{flex-basis:86.5px}}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-decision{min-height:0;background:none}#ssr-content .ssr-decision .ssr-dc-grille{display:block;max-width:none;padding:0;min-height:0}#ssr-content .ssr-decision :is(.ssr-dc-gauche,.ssr-dc-droite,.ssr-dc-outils){display:none!important}#ssr-content .ssr-decision .ssr-dc-main{padding:0;border:none}#ssr-content .ssr-decision :is(.ssr-dc-tags li,.ssr-dc-badge){background:#fff!important;color:#000!important;border:1px solid #000}}
@media (max-width:383.9px){#ssr-content .ssr-decision .ssr-dc-outils-m>.ssr-dc-btn:nth-child(3),#ssr-content .ssr-decision .ssr-dc-outils-m>.ssr-dc-btn:nth-child(4){height:51.2px}}
@media (max-width:404.9px){#ssr-content .ssr-decision .ssr-dc-outils-m>.ssr-dc-btn:nth-child(n+5){height:51.2px}}
`,
  theme: `
#ssr-keep.ssr-type-theme{max-width:none;margin:0;padding:0;}
#ssr-content .ssr-theme a{color:#047857;text-decoration:none;}
#ssr-content .ssr-theme,#ssr-content .ssr-jurisprudence{padding:112px 24px 64px;font-family:var(--ssr-ui);font-size:16px;line-height:1.7;color:#1A1A1A;}
#ssr-content .ssr-theme article{max-width:860px;margin:0 auto;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) svg{flex:none;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) :is(h1,h2){font-family:var(--ssr-titre);font-weight:600;-webkit-text-stroke:var(--ssr-trait-600) currentColor;letter-spacing:-0.02em;color:#1A1A1A;}
#ssr-content :is(.ssr-theme-eyebrow,.ssr-juris-eyebrow){display:inline-flex;align-items:center;gap:6.4px;font-size:12.8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#047857;margin-bottom:12px;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) h2{display:flex;align-items:center;gap:8px;font-size:20px;line-height:1.7;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #E5E7EB;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) ul{list-style:none;margin:0;padding:0;display:grid;}
#ssr-content .ssr-theme .ssr-bc{display:flex;flex-wrap:wrap;gap:8px;font-size:14.4px;line-height:1.7;color:#9CA3AF;margin:0 0 24px;}
#ssr-content .ssr-theme h1{font-size:clamp(1.6rem,3.5vw,2.3rem);line-height:1.2;margin:0 0 16px;}
#ssr-content .ssr-theme .ssr-theme-chapo{font-size:16.8px;line-height:1.7;margin:0 0 14.4px;}
#ssr-content .ssr-theme .ssr-theme-stats{font-size:15.2px;line-height:1.7;color:#9CA3AF;margin:0;padding:12px 16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;}
#ssr-content .ssr-theme section{margin-top:40px;}
#ssr-content .ssr-theme .ssr-theme-arts ul{gap:8px;}
#ssr-content .ssr-theme .ssr-theme-arts li{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:8.8px 13.6px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;}
#ssr-content .ssr-theme .ssr-theme-arts a{color:#065F46;font-weight:500;}
#ssr-content .ssr-theme .ssr-theme-art-n{font-size:12.8px;color:#9CA3AF;white-space:nowrap;}
#ssr-content .ssr-theme .ssr-theme-decs ul{gap:16px;}
#ssr-content .ssr-theme .ssr-theme-dec{padding:16px 18.4px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.04);}
#ssr-content .ssr-theme .ssr-theme-dec a{color:#065F46;font-weight:600;}
#ssr-content .ssr-theme .ssr-theme-dec-meta{display:block;font-size:13.6px;color:#9CA3AF;margin-top:3.2px;}
#ssr-content .ssr-theme .ssr-theme-dec p{font-size:14.72px;line-height:1.6;margin:9.6px 0 0;}
#ssr-content .ssr-theme .ssr-theme-q{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:12px 16px;margin-bottom:9.6px;}
#ssr-content .ssr-theme .ssr-theme-q h3{display:list-item;list-style:inside disclosure-open;font-family:inherit;font-size:16px;line-height:1.7;font-weight:600;letter-spacing:normal;color:#1A1A1A;margin:0;}
#ssr-content .ssr-theme .ssr-theme-q p{font-size:16px;line-height:1.65;margin:11.2px 0 3.2px;}
#ssr-content .ssr-theme .ssr-theme-more{margin:36px 0 0;text-align:center;font-size:16px;line-height:1.7;}
#ssr-content :is(.ssr-theme-more,.ssr-juris-more) a{font-weight:600;}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-theme{padding:0;}}
@media (max-width:640px){#ssr-content .ssr-theme,#ssr-content .ssr-jurisprudence{padding-top:88px;}#ssr-content .ssr-theme .ssr-theme-arts li{flex-direction:column;gap:3.2px;}}
`,
  jurisprudence: `
#ssr-keep.ssr-type-jurisprudence{max-width:none;margin:0;padding:0;}
#ssr-content .ssr-jurisprudence a{color:#047857;text-decoration:none;}
#ssr-content .ssr-theme,#ssr-content .ssr-jurisprudence{padding:112px 24px 64px;font-family:var(--ssr-ui);font-size:16px;line-height:1.7;color:#1A1A1A;}
#ssr-content .ssr-jurisprudence article{max-width:980px;margin:0 auto;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) svg{flex:none;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) :is(h1,h2){font-family:var(--ssr-titre);font-weight:600;-webkit-text-stroke:var(--ssr-trait-600) currentColor;letter-spacing:-0.02em;color:#1A1A1A;}
#ssr-content :is(.ssr-theme-eyebrow,.ssr-juris-eyebrow){display:inline-flex;align-items:center;gap:6.4px;font-size:12.8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#047857;margin-bottom:12px;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) h2{display:flex;align-items:center;gap:8px;font-size:20px;line-height:1.7;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #E5E7EB;}
#ssr-content :is(.ssr-theme,.ssr-jurisprudence) ul{list-style:none;margin:0;padding:0;display:grid;}
#ssr-content :is(.ssr-theme-more,.ssr-juris-more) a{font-weight:600;}
#ssr-content .ssr-jurisprudence h1{font-size:clamp(1.7rem,3.8vw,2.5rem);line-height:1.2;margin:0 0 14.4px;}
#ssr-content .ssr-jurisprudence .ssr-juris-intro{font-size:16.32px;line-height:1.7;max-width:760px;margin:0 0 24px;}
#ssr-content .ssr-juris-search{display:flex;align-items:center;gap:9.6px;max-width:640px;padding:8px 9.6px 8px 16px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.04);color:#9CA3AF;}
#ssr-content .ssr-juris-field{flex:1;height:18px;}
#ssr-content .ssr-juris-btn{flex:none;width:112.7px;height:35.2px;border-radius:8px;background:#047857;}
#ssr-content .ssr-jurisprudence section{margin-top:40px;}
#ssr-content .ssr-jurisprudence h2{font-size:20.8px;}
#ssr-content .ssr-juris-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}
#ssr-content .ssr-juris-grid li{display:flex;flex-direction:column;gap:4px;padding:13.6px 16px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;}
#ssr-content .ssr-juris-grid--matieres li{border-left:3px solid #047857;}
#ssr-content .ssr-juris-grid a{color:#1A1A1A;font-size:15.52px;line-height:1.35;font-weight:700;}
#ssr-content .ssr-juris-grid .ssr-theme-art-n{font-size:12.8px;line-height:1.7;color:#9CA3AF;}
#ssr-content .ssr-jurisprudence .ssr-juris-more{margin:36px 0 0;text-align:center;font-size:16px;line-height:1.7;}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-jurisprudence{padding:0;}#ssr-content .ssr-juris-search{display:none!important;}}
@media (max-width:640px){#ssr-content .ssr-theme,#ssr-content .ssr-jurisprudence{padding-top:88px;}#ssr-content .ssr-juris-btn{width:103.1px;height:33.6px;}}
`,
  guides: `
#ssr-keep.ssr-type-guides{max-width:none;margin:0;padding:0}
#ssr-content .ssr-ed{font:16px/1.7 var(--ssr-ui);color:#1A1A1A}
#ssr-content .ssr-ed :where(h1,h2,h3){font-family:var(--ssr-titre);font-weight:600;letter-spacing:-.02em;-webkit-text-stroke:var(--ssr-trait-600) currentColor;color:#1A1A1A;margin:0}
#ssr-content .ssr-ed :where(p,ul,li){margin:0;padding:0;font-size:inherit;line-height:inherit}
#ssr-content .ssr-ed :where(a){color:inherit;text-decoration:none}
#ssr-content .ssr-ed svg{display:block;flex-shrink:0}
#ssr-content :is(.ssr-guides,.ssr-guide){padding:112px 24px 64px;background:#fff}
#ssr-content :is(.ssr-guides-c,.ssr-guide-c){max-width:780px;margin:0 auto}
#ssr-content .ssr-guides-surtitre{display:flex;align-items:center;gap:6.4px;height:21.76px;margin:1.1px 0 12px;font-size:12.8px;line-height:21.76px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#047857}
#ssr-content .ssr-guides h1{font-size:clamp(1.7rem,3.8vw,2.4rem);line-height:1.2;margin-bottom:14.4px}
#ssr-content .ssr-guides-chapo{font-size:16.32px;margin-bottom:16px}
#ssr-content .ssr-guides-list{list-style:none;margin-top:32px;display:grid;gap:16px}
#ssr-content .ssr-guides-list li{padding:18.4px 20.8px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.04)}
#ssr-content .ssr-guides-list a{display:block;margin-bottom:5.6px;font:700 17.6px/1.7 var(--ssr-titre);-webkit-text-stroke:var(--ssr-trait-700) currentColor}
#ssr-content .ssr-guides-list p{font-size:14.72px;line-height:27.2px;color:#9CA3AF}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-guides{padding:0}}
@media (max-width:640px){#ssr-content :is(.ssr-guides,.ssr-guide){padding-top:88px}}
`,
  guide: `
#ssr-keep.ssr-type-guide{max-width:none;margin:0;padding:0}
#ssr-content .ssr-ed{font:16px/1.7 var(--ssr-ui);color:#1A1A1A}
#ssr-content .ssr-ed :where(h1,h2,h3){font-family:var(--ssr-titre);font-weight:600;letter-spacing:-.02em;-webkit-text-stroke:var(--ssr-trait-600) currentColor;color:#1A1A1A;margin:0}
#ssr-content .ssr-ed :where(p,ul,li){margin:0;padding:0;font-size:inherit;line-height:inherit}
#ssr-content .ssr-ed :where(a){color:inherit;text-decoration:none}
#ssr-content .ssr-ed svg{display:block;flex-shrink:0}
#ssr-content :is(.ssr-guides,.ssr-guide){padding:112px 24px 64px;background:#fff}
#ssr-content :is(.ssr-guides-c,.ssr-guide-c){max-width:780px;margin:0 auto}
#ssr-content .ssr-guide .ssr-bc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;font-size:14.4px;line-height:1.7;color:#9CA3AF}
#ssr-content .ssr-guide .ssr-bc a{color:#047857}
#ssr-content .ssr-guide h1{font-size:clamp(1.6rem,3.5vw,2.3rem);line-height:1.25;margin-bottom:8px}
#ssr-content .ssr-guide-date{font-size:13.6px;color:#9CA3AF;margin-bottom:24px}
#ssr-content .ssr-guide-body{font-size:16.32px;line-height:1.75}
#ssr-content .ssr-guide-body p{margin:0 0 16px}
#ssr-content .ssr-guide-body h2{font-size:21.6px;line-height:1.75;margin:35.2px 0 12.8px;padding-bottom:6.4px;border-bottom:1px solid #E5E7EB}
#ssr-content .ssr-guide-body h3{font-size:17.6px;line-height:1.75;margin:24px 0 8px}
#ssr-content .ssr-guide-body ul{margin:0 0 16px;padding-left:22.4px}
#ssr-content .ssr-guide-body li{margin-bottom:6.4px}
#ssr-content .ssr-guide-body a{color:#065F46;text-decoration:underline;text-decoration-color:rgba(0,0,0,.2);text-underline-offset:2px}
#ssr-content .ssr-guide-faq{margin-top:40px}
#ssr-content .ssr-guide-faq h2{font-size:20px;line-height:1.7;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #E5E7EB}
#ssr-content .ssr-guide-qr{background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:12px 16px;margin-bottom:9.6px}
#ssr-content .ssr-guide-qr h3{font:600 16px/1.7 var(--ssr-ui);letter-spacing:normal;-webkit-text-stroke:0}
#ssr-content .ssr-guide-qr p{margin:11.2px 0 3.2px;line-height:1.65}
#ssr-content .ssr-guide-theme{margin-top:36px;text-align:center}
#ssr-content .ssr-guide-theme a{display:inline-flex;align-items:center;gap:6.4px;color:#047857;font-weight:600}
#ssr-content .ssr-guide-devise{margin-top:24px;font-size:13.6px;color:#9CA3AF;text-align:center}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-guide{padding:0}}
@media (max-width:640px){#ssr-content :is(.ssr-guides,.ssr-guide){padding-top:88px}}
`,
  doctrine: `
#ssr-keep.ssr-type-doctrine{max-width:none;margin:0;padding:0}
#ssr-content .ssr-ed{font:16px/1.7 var(--ssr-ui);color:#1A1A1A}
#ssr-content .ssr-ed :where(h1,h2,h3){font-family:var(--ssr-titre);font-weight:600;letter-spacing:-.02em;-webkit-text-stroke:var(--ssr-trait-600) currentColor;color:#1A1A1A;margin:0}
#ssr-content .ssr-ed :where(p,ul,li){margin:0;padding:0;font-size:inherit;line-height:inherit}
#ssr-content .ssr-ed :where(a){color:inherit;text-decoration:none}
#ssr-content .ssr-ed svg{display:block;flex-shrink:0}
#ssr-content .ssr-doctrine{min-height:100vh;padding:96px 0 64px;background:#F9FAFB}
#ssr-content .ssr-doctrine-c{max-width:820px;margin:0 auto;padding:0 24px}
#ssr-content .ssr-doctrine-retour{display:flex;padding:24px 0 20px}
#ssr-content .ssr-doctrine-retour a{display:inline-flex;align-items:center;gap:6.4px;font-size:14.4px;font-weight:600;color:#047857}
#ssr-content .ssr-doctrine-carte{background:#fff;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.05);overflow:hidden}
#ssr-content .ssr-doctrine-tete{padding:36px 40px 28px;border-bottom:1px solid #F3F4F6;background:linear-gradient(#fff,#F9FAFB)}
#ssr-content .ssr-doctrine-surtitre{display:flex;align-items:center;gap:6.4px;height:20.4px;margin:1.8px 0 12px;font-size:12px;line-height:20.4px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#047857}
#ssr-content .ssr-doctrine h1{font:700 clamp(1.5rem,3.5vw,2.2rem)/1.25 var(--ssr-ui);letter-spacing:-.02em;-webkit-text-stroke:0;color:#111827;margin-bottom:20px}
#ssr-content .ssr-doctrine .ssr-meta{list-style:none;display:flex;flex-wrap:wrap;gap:9.6px 24px;font-size:14.4px;color:#4B5563}
#ssr-content .ssr-doctrine .ssr-meta li{display:flex;align-items:center;gap:6.4px}
#ssr-content .ssr-doctrine .ssr-meta svg{color:#047857}
#ssr-content .ssr-doctrine-articles{margin-bottom:20px;padding:14.4px 17.6px;border-left:3px solid #047857;background:rgba(4,120,87,.04);border-radius:4px}
#ssr-content .ssr-doctrine-articles h2{font-size:15.2px;line-height:1.7;margin-bottom:8px}
#ssr-content .ssr-doctrine-articles ul{padding-left:17.6px}
#ssr-content .ssr-doctrine-articles li{margin:3.2px 0}
#ssr-content .ssr-doctrine-actions{display:flex;flex-wrap:wrap;gap:12px;padding:20px 40px 0}
#ssr-content .ssr-doctrine-actions span{width:187.3px;height:39.8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff}
#ssr-content .ssr-doctrine-actions span+span{width:187.8px;border-style:dashed;background:none}
#ssr-content .ssr-doctrine-corps{padding:36px 40px 44px;font:16.8px/1.8 var(--ssr-texte);color:#374151;text-align:justify}
#ssr-content .ssr-doctrine-extrait{margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #E5E7EB}
#ssr-content .ssr-doctrine-extrait h2{font:600 15.2px/1.8 var(--ssr-texte);letter-spacing:-.02em;-webkit-text-stroke:0;color:#111827;margin-bottom:16px;text-align:left}
#ssr-content .ssr-doctrine-extrait p{margin-bottom:21.6px}
#ssr-content .ssr-doctrine-extrait p:last-child{margin-bottom:0;color:#9CA3AF}
#ssr-content .ssr-doctrine-gate{max-width:460px;margin:0 auto;padding:24px 16px 8px;text-align:center}
#ssr-content .ssr-doctrine-cadenas{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;margin-bottom:16px;border-radius:50%;background:#ECFDF5;color:#047857}
#ssr-content .ssr-doctrine-gate p{margin-bottom:16px;line-height:1.6;color:#4B5563;text-align:center}
#ssr-content .ssr-doctrine-gate a{color:#047857;text-decoration:underline}
#ssr-content .ssr-doctrine-fiche{list-style:none;display:flex;flex-wrap:wrap;gap:4px 20px;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;font:13.6px/1.7 var(--ssr-ui);color:#6B7280;text-align:left}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-doctrine{min-height:0;padding:0;background:none}#ssr-content .ssr-doctrine-actions{display:none!important}#ssr-content .ssr-doctrine-carte{border:none}}
@media (max-width:640px){#ssr-content .ssr-doctrine-tete{padding:28px 24px 24px}#ssr-content .ssr-doctrine-actions{padding:20px 24px 0}#ssr-content .ssr-doctrine-corps{padding:28px 24px 32px}}
`,
  codes: `
#ssr-keep.ssr-type-codes{max-width:none;margin:0;padding:0}
#ssr-content .ssr-ed{font:16px/1.7 var(--ssr-ui);color:#1A1A1A}
#ssr-content .ssr-ed :where(h1,h2,h3){font-family:var(--ssr-titre);font-weight:600;letter-spacing:-.02em;-webkit-text-stroke:var(--ssr-trait-600) currentColor;color:#1A1A1A;margin:0}
#ssr-content .ssr-ed :where(p,ul,li){margin:0;padding:0;font-size:inherit;line-height:inherit}
#ssr-content .ssr-ed :where(a){color:inherit;text-decoration:none}
#ssr-content .ssr-ed svg{display:block;flex-shrink:0}
#ssr-content .ssr-codes{min-height:100vh;background:linear-gradient(#F9FAFB,#fff)}
#ssr-content .ssr-codes-hero{position:relative;overflow:hidden;padding:140px 24px 80px;text-align:center;background:linear-gradient(#fff,#F9FAFB)}
#ssr-content .ssr-codes-hero::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:200px;height:3px;background:linear-gradient(90deg,transparent,#047857,transparent)}
#ssr-content .ssr-codes-hero-c{max-width:800px;margin:0 auto}
#ssr-content .ssr-codes-embleme{display:flex;align-items:center;justify-content:center;width:80px;height:80px;margin:0 auto 28px;border-radius:20px;background:linear-gradient(135deg,#047857,#10B981);color:#fff;box-shadow:0 8px 30px rgba(4,120,87,.25)}
#ssr-content .ssr-codes-titre{margin-bottom:16px;font:700 clamp(2.2rem,5vw,3.5rem)/1.7 var(--ssr-titre);letter-spacing:-.02em;-webkit-text-stroke:var(--ssr-trait-700) currentColor;color:#111827}
#ssr-content .ssr-codes-chapo{margin-bottom:32px;font-size:18.4px;color:#6B7280}
#ssr-content .ssr-codes-recherche{display:flex;align-items:center;max-width:500px;height:46px;margin:0 auto;padding:0 24px;border:1px solid #E5E7EB;border-radius:50px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.05);color:#9CA3AF}
#ssr-content .ssr-codes-contenu{padding:60px 24px}
#ssr-content .ssr-codes-c{max-width:1200px;margin:0 auto}
#ssr-content .ssr-codes-onglets{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 28px;border-bottom:1px solid rgba(0,0,0,.08)}
#ssr-content .ssr-codes-onglets span{position:relative;width:122.8px;height:45px;margin-bottom:-1px;border-bottom:3px solid transparent}
#ssr-content .ssr-codes-onglets span:first-child{width:212.4px;border-bottom-color:#1a2238}
#ssr-content .ssr-codes-onglets span:last-child{width:148.3px}
#ssr-content .ssr-codes-onglets span::after{content:'';position:absolute;left:18px;right:18px;top:15px;height:14px;border-radius:7px;background:#EEF0F4}
#ssr-content .ssr-codes-sous-titre{margin-bottom:24px;font-size:15.68px;font-style:italic;color:#6B7280}
#ssr-content .ssr-codes-grille{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
#ssr-content .ssr-codes-carte{padding:28px;border:1px solid #E5E7EB;border-radius:20px;background:#fff}
#ssr-content .ssr-codes-carte--bientot{opacity:.6}
#ssr-content .ssr-codes-carte-tete{display:flex;gap:16px;margin-bottom:20px}
#ssr-content .ssr-codes-icone{display:flex;align-items:center;justify-content:center;width:56px;height:56px;flex-shrink:0;border-radius:14px;color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent)}
#ssr-content .ssr-codes-carte h2{margin-bottom:4px;font-size:19.2px;font-weight:700;line-height:1.7;-webkit-text-stroke:var(--ssr-trait-700) currentColor;color:#111827}
#ssr-content .ssr-codes-carte-tete p{font-size:13.6px;line-height:1.4;color:#9CA3AF}
#ssr-content .ssr-codes-carte ul{list-style:none;display:flex;flex-direction:column;gap:8px}
#ssr-content .ssr-codes-carte a{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:#F9FAFB;font-size:14.4px;color:#374151}
#ssr-content .ssr-codes-carte a::before,#ssr-content .ssr-codes-carte a::after{content:'';flex-shrink:0;width:16px;height:16px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8'/%3E%3C/svg%3E") center/100% no-repeat}
#ssr-content .ssr-codes-carte a::after{width:14px;height:14px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D1D5DB' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 18 6-6-6-6'/%3E%3C/svg%3E")}
#ssr-content .ssr-codes-carte a span:first-child{flex:1;font-weight:500}
#ssr-content .ssr-codes-n{padding:2px 8px;border-radius:10px;background:#fff;font-size:12px;color:#9CA3AF}
#ssr-content .ssr-codes-n:empty{width:56px;height:24.4px}
#ssr-content .ssr-codes-bientot{padding:20px;text-align:center}
#ssr-content .ssr-codes-bientot span{display:inline-block;padding:6px 14px;border-radius:20px;background:#F3F4F6;font-size:12.8px;font-weight:500;color:#9CA3AF}
#ssr-content .ssr-codes-index{margin-top:60px}
#ssr-content .ssr-codes-index h1{margin-bottom:12px;font-size:1.75rem;line-height:1.3}
#ssr-content .ssr-codes-index>p{color:#6B7280}
#ssr-content .ssr-codes-index h2{margin:28px 0 12px;font-size:1.2rem}
#ssr-content .ssr-codes-index ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 24px;font-size:14.4px}
#ssr-content .ssr-codes-index a{color:#047857}
@media print{#ssr-content *{-webkit-text-stroke:0!important}#ssr-content .ssr-codes{min-height:0}#ssr-content .ssr-codes-hero{padding:0 0 20px}#ssr-content :is(.ssr-codes-recherche,.ssr-codes-onglets,.ssr-codes-grille~.ssr-codes-index){display:none!important}#ssr-content .ssr-codes-embleme{color:#047857}}
@media (max-width:1024px){#ssr-content .ssr-codes-grille{grid-template-columns:repeat(2,1fr)}}
@media (max-width:768px){#ssr-content .ssr-codes-grille{grid-template-columns:1fr}#ssr-content .ssr-codes-hero{padding-top:120px}}
`,
};

/** Balise <style> du type de page servi, à placer dans le <head> ; chaîne vide pour un type sans bloc. */
export function styleSsr(type) {
  const css = STYLES_SSR[type];
  return css ? `<style id="ssr-style-${type}">${css}</style>` : '';
}
