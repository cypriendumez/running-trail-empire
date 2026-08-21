# La dépendance à intervals.icu — ce qui est établi, ce qui reste à demander

Relevé le 21/08/2026. À joindre au dossier de cession.

## Ce qui est ÉTABLI, publiquement et par écrit

**Source :** `forum.intervals.icu`, sujet **114087** — « Intervals.icu API Terms and
Conditions », publié par **david** (auteur et exploitant du service) le 22/10/2025,
**effectif au 23 octobre 2025**.

- **§1 — Licence.** « non-exclusive, worldwide, royalty-free, **perpetual** license to
  access and use the API for **any lawful purpose, including commercial use** ».
  L'usage commercial est donc explicitement autorisé, sans redevance, à titre perpétuel.
- **§1.1 — Attribution Garmin.** Toute application affichant des informations dérivées de
  données Garmin **doit** afficher l'attribution Garmin. → **Traité** : voir
  `src/components/legal/AttributionGarmin.tsx`, présent sur les 4 vues de données et
  verrouillé par un test.
- **§4 — Résiliation.** Suspension possible en cas de violation, avec **7 jours** de
  préavis lorsque c'est possible.
- **§7 — Modification des conditions.** **30 jours** de préavis par e-mail.
- **§8 — Droit applicable :** Afrique du Sud.
- **Contact :** support@intervals.icu

## Ce qui RESTE à demander (courrier ci-dessous)

Les conditions ne disent rien de la **continuité du service** — le point qu'un acheteur
soulèvera. Trois questions, aucune n'est bloquante mais chacune rassure.

## Courrier prêt à envoyer — support@intervals.icu

> **Subject:** Commercial use of the Intervals.icu API — Pacevo (running/trail coaching app)
>
> Hello David,
>
> I run Pacevo, a running and trail coaching web app. It reads athlete activities and
> wellness data through the Intervals.icu API, and writes planned workouts back to the
> athlete's Intervals.icu calendar. Every athlete connects with their own API key.
>
> I have read the API Terms and Conditions (forum topic 114087, effective 23 October
> 2025) and I am relying on §1, which permits commercial use. I have also implemented
> §1.1: the app displays "Charts may include data from Garmin devices" on every view that
> shows activity or wellness data, using the wording you recommended in that thread.
>
> I am preparing to sell the application, and the buyer will carry out due diligence on
> its dependencies. Three questions, if you have a moment:
>
> 1. **Attribution** — is the blanket notice above sufficient for Pacevo, or would you
>    prefer per-activity attribution using the `device_name` field?
> 2. **Transfer** — the API terms grant the licence to whoever uses the API. Do you see
>    any issue with the application changing owner, the new owner continuing under the
>    same terms?
> 3. **Continuity** — is there anything you can say about the expected continuity of the
>    service, or the notice period athletes and integrators would receive if Intervals.icu
>    were to stop operating? Even an informal answer would help.
>
> I am not asking for any commitment beyond what the terms already say — a short written
> reply is all I need for the file. Thank you for the API and for publishing clear terms;
> both are rarer than they should be.
>
> Best regards,
> Cyprien Dumez — Pacevo
> cypriendumez@outlook.fr

## Le risque résiduel, dit franchement

Tout le produit passe par un service tiers tenu par une personne. Les conditions le
couvrent, mais elles ne garantissent pas la pérennité — aucune ne le fait. Les données
des athlètes (activités, sommeil, VFC) sont **copiées dans la base Pacevo** : une
fermeture d'intervals.icu couperait la synchronisation à venir, elle n'effacerait pas
l'historique déjà importé.
