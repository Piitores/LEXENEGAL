# Nettoyage des références doctrine à la source — design + plan

> **Validé par le propriétaire** (chat 2026-07-17). Exécution séquentielle en session
> (étapes couplées : export → parsing → revue → update), revue adversariale avant UPDATE.

**But** : `doctrine.reference_complete` (668 lignes) contient ~165 en-têtes bruts
(« N° 532 MEF/DGID/DLEC/BCTX Objet : demande d'arbitrage. Monsieur, … ») et deux
casses mélangées. Cible : format canonique unique **« N° 341 MEFP/DGID/DLEC/BL du
10 août 2013 »** pour les 668 (décision proprio : tout uniformiser), + remplissage
des `date`/`annee` NULL quand l'extraction est sûre.

**Constats d'exploration (2026-07-17)** :
- 668 lettres ; 0 ref vide ; 100 % commencent par « N° » ; 100 % retrouvables dans
  `content_raw` (préfixe normalisé) → écrasement sans perte, le brut reste en base.
- 161 refs contiennent « objet », 4 longues sans « objet », 447 finissent déjà par
  une date propre ; 5 dates NULL ; OCR : années éclatées (« 200 4 », « 2 004 »)
  et aberrantes (« 20109 ») ; incohérences date/annee/ref repérées (ex. n°329).
- Triggers : `trg_doctrine_fts_vector` (re-FTS auto à l'update de reference_complete),
  `doctrine_updated_at`. Ré-embedding : cron quotidien (content_hash). Slugs intacts.

## Méthode

1. **Backup** : `zz_backup_doctrine_refs_20260717` (id, reference_complete, date,
   annee) + RLS sans policy (convention zz_).
2. **Export** des 668 lignes via MCP SQL (JSON, paginé) → scratchpad.
3. **Script déterministe** (`clean-doctrine-refs.mjs`, scratchpad, purgé après) :
   - numéro : `N[°ºo]?\s*0*(\d+)` — doit ÉGALER la colonne `numero`, sinon flag ;
   - sigle : séquence MAJ/chiffres/`/.-` après le numéro, coupée aux frontières
     (« du », « DU », « Dakar », « Objet », mot en minuscules, ponctuation) ;
   - date : `du <j> <mois> <année>` | `Dakar, le <j> <mois> <année>` avec réparation
     des années éclatées (`200 4`→2004) ; années à 5 chiffres = flag, pas de réparation ;
   - recomposition : `N° {numero} {sigle} du {j} {mois} {année}` (mois minuscule,
     « 1er » conservé) ; sans date sûre → `N° {numero} {sigle}` ;
   - date extraite ≠ colonne `date` non-nulle → flag revue (jamais d'écrasement) ;
     colonne NULL + extraction sûre → remplir `date` et `annee` ;
   - sortie : `propositions.csv` (668 lignes avant/après + flags) + stats.
4. **Revue adversariale** (sous-agents) : traçabilité de chaque composant au brut
   (zéro fabrication), cohérence des dates, casse/format. Résolution des flags.
5. **Application** : UPDATE par lots (`UPDATE … FROM (VALUES …)`) via MCP, lignes
   non flaggées seulement ; flags irrésolus = liste proprio, lignes non modifiées.
6. **Vérification** : compteurs (0 « objet » restant, format canonique partout),
   échantillon, capture front doctrine mobile, et enquête sur le « DATE INCONNUE »
   affiché en tête de liste alors que 5 lettres seulement sont sans date.
7. **Clôture** : trace au vault, purge du script/CSV (règle publication → nettoyage).

**Écarté** : SQL pur (pas de réparation OCR ni d'artefact de revue), extraction LLM
(risque de fabrication, les règles couvrent le format).
