# Cíyán v0.8.12 — Shared AND / OR / NOT tag filters

The Words, Grammar and Study screens now use one shared tag-selection state. Reader
remains independent of these filters. Changing a tag on one screen immediately
affects results in the other two screens; ordinary search text and score/rating
controls remain specific to their screen. Existing study sessions retain their
starting filter snapshot.

Tag button cycle: **AND** (green) → **OR** (yellow) → **NOT** (red) → neutral.

1. With at least one AND tag, an item must match **every** selected AND path.
2. An item matching **any** NOT path is excluded, regardless of other matches.
3. With at least one OR tag, an item must match **at least one** selected OR path.

A parent matches any descendant path. Grammar browsing and Grammar/Listening
study apply this logic to the same union of the grammar's own tags and its
sentence vocabulary's tags. NOT is therefore strict for grammar. Particle study
uses the union of its participating vocabulary tags. Score/prerequisite gates
remain unchanged.

The selected tags are shown as labelled, color-coded chips **outside** the
collapsible Words and Grammar filter trees, so the selection is visible when
those panels are closed. The same chips are visible in Study.

## TSK diagnosis

The existing v0.8.11 dictionary already contained exactly 100 HSK and 100
non-HSK entries in each of TSK01–TSK12. TSK01–08 contains 800 non-HSK words;
TSK01–12 contains 1,200. The previous AND-only filtering could make multiple
mutually exclusive TSK tiers yield no results. For the first 800 extra words,
set TSK01–TSK08 to **OR** and HSK to **NOT**, with no AND tags.

No vocabulary definitions, card identities, review schedules or chapter data
were changed. The existing full backup format remains compatible, and a
v0.8.11 → v0.8.12 identity migration is registered for versioned backups.
