# V78 release candidate

Combined changes: Mega Evolvable mirrored-location state parity; Top Attackers
search and Advanced Filtering; approved teal/purple podium artwork; saved real
rankings; conservative daily ranking-balance refresh. Existing visuals, sliders,
selection behavior, backgrounds and species-updater rules are preserved.

## Verification

Full real-data Chromium validation passed in GitHub run 46072975478, commit
ebcc792a3d675d2c920a99a51c1aa38aedd6351f. Tested application SHA256:
29309f0f3145dc946128f29b6084ed3911b339c83eadbdfbc64260696824af7b.
Coverage includes all 19 search groups at counts 1/10/30, global mixed-type
ordering, form names and sprites, selection/restoration, Count keyboard steps,
Moveset/Elite/exclusion, actual image decoding and four viewport sizes.
The later refresh integration requires its own isolated GitHub run before release.
Physical iPhone visual behavior has not been independently verified.

## Deliberately held records

These do not consume ranking positions. Ordinary species cards are unaffected.

| Records | Reason |
| --- | --- |
| Shadow Hisuian Growlithe, Arcanine, Voltorb, Electrode; Shadow Kangaskhan; Shadow Paldean Wooper | Independent form-release evidence not confirmed by this review |
| Ditto | Transform does not have a fixed opposing-species-independent attacking score in this calculator |
| Aegislash (both source forms), Busted Mimikyu, Gorging Cramorant, Hangry Morpeko | PvE form eligibility/representation remains unconfirmed |
| Smeargle | No complete usable move pool in the pinned calculator |
| Fifteen restricted-state move pairs | Required Shadow/purified release evidence not confirmed; other eligible pairs remain usable |

The reviewed input contains 1,615 eligible forms; the saved top-30 groups use
417 distinct forms. These are battle-form records, not 1,615 different species.
An older held-form sensitivity report predates resolved aliases and must not be
used as the current exclusion list. The current held roster is recorded in
refresh-inputs/roster.json and exclusions are produced by prepare_reviewed.cjs.

## Native-search limits

Form identification and moveset requirements remain separate. Where Pokémon GO
cannot uniquely identify a form without excluding valid specimens, the saved
form predicate uses its documented fallback and reports approximation. Mega and
Primal results do not require current transformation. Shadows have separate
criteria. Automatic Mega charged attacks require only the appropriate fast move.
Positive Apex ++ matching is inferred, not directly verified on an owned ++
specimen. User tests verified ordinary/+ exclusions and both charged slots.

A 5,357-character exclusion plus `&1` (5,359 total) was tested in game and
reached the final species condition. The visual ellipsis did not truncate it.
This does not establish the game's maximum. The 20,000-character engineering
bound and existing expression-complexity limits remain enforced; oversized
combinations fail explicitly rather than silently changing their meaning.

## Publication status

Candidate only. No V78 merge or deployment has occurred. The existing daily
species updater is separate. The new ranking refresh is packaged and locally
tested, but is not installed, enabled or hosted-run verified yet.
