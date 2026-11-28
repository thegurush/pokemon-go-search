# V78 Top Attackers

The application loads saved rankings embedded in index.html. Visitors do not
wait for a ranking source. The saved JSON is data/attacker-rankings.json.

Ranking policy: level 40, perfect IVs, eDPS, neutral defense 180, solo team of six,
10-second relobby, half-second turns, Mega level 1, type affinity off. Typed
rankings apply the selected attacking type's effectiveness. Mixed fast/charged
pairs must beat that form's same-type pair and reach 85% of the strongest
same-type attacker. Overall uses neutral effectiveness. Elite-off rankings are
calculated separately. One best eligible fast/charged pair is enough; the native
query accepts the charged move in either slot without requiring an unlock.

## Refreshing

`node rankings/refresh.cjs CALCULATOR_CHECKOUT DATA_CHECKOUT`

Calculator code is fixed to eef2ddbb822bae0c0f4f5060115aef39dbea091a. Data is read
from a clean, identified Git commit. Its baseline is
e88e23950e58968f2283625a6fdd65506195796d. Only numeric stat/move balance changes
within the reviewed schema are admitted automatically. New or removed records,
changed types, release flags, move pools, Elite eligibility, or diverging
cosmetic profiles stop the refresh for review. This is not an unrestricted
new-form importer. Missing metadata is never invented.

The proposed daily-rankings.yml runs daily at 12:57 UTC and supports manual runs.
It validates source inputs, recalculates complete eligible pairs, checks review
evidence, builds all 38 groups, decodes resulting sprites, runs regression and
Chromium tests, commits the result, deploys through Pages, and checks hosted HTML.
Failures before commit preserve the repository's saved application. The shared
Pages concurrency group serializes this with the existing species updater and
publisher. The species updater remains separate and keeps its existing sources
and schedule.

This workflow is packaged, not yet installed or verified on GitHub. Do not call
ranking refresh active until its hosted manual run succeeds.

## Known limits

See RELEASE_NOTES.md for held forms and native-search approximations. Source
code is executed only during builds from the pinned checkout; upstream JS is
not embedded in the application. Source URLs and hashes accompany saved data.
The source-output review is an engineering provenance decision, not a claim of
maintainer permission or legal clearance.

## Tests

Existing preservation, slider and browser suites include the V78 behavior.
`node tests/ranking_refresh.cjs` checks refresh rejection boundaries.
`node tests/ranking_refresh_integration.cjs CALCULATOR_CHECKOUT DATA_CHECKOUT`
recalculates a simulated balance change and verifies that an unknown new move
leaves both saved outputs intact. The simulation never modifies production data.
