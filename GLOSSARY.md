# Lineage Training

Recommending which umas a player should train next, as parents in a lineage, for an upcoming Champions Meeting (CM).

## Language

**Uma**:
A character, e.g. one trainable horse girl, independent of which version of her is used.
_Avoid_: horse, character (when the version matters)

**Outfit**:
A specific version of an uma (e.g. a different release or costume) with its own aptitudes, skills and rarity.
_Avoid_: skin, variant

**Veteran**:
A completed training run of an uma, owned by the player, carrying sparks and parents of its own.
_Avoid_: save, build

**Roster**:
The set of umas and outfits a player owns, persisted between sessions.

**Parent**:
A veteran placed directly above the trainee in a lineage.

**Grandparent**:
A parent's parent in a lineage.

**Great-grandparent**:
A grandparent's parent in a lineage; no official game name.
_Avoid_: ggp (in prose; abbreviation only)

**Core loop**:
The long-lived foundation line of great-grandparents, kept strong across CMs by preserving high-tier general sparks and dirt sparks for affinity.

**Side loop**:
Grandparents and parents built specifically for one upcoming CM, carrying the CM's relevant pink spark plus general lineage skills and CM skills.

**Ace**:
The final trainee run for the CM; it ignores pink sparks and spark chance and only maximizes inherited relevant skills, measured in lengths gained.
_Avoid_: trainee (when meaning the final CM runner)

**Ace veteran**:
A veteran scored as a CM runner as herself, in the running style she ran in her career, with her actual stats and equipped skills. Ranked against other Ace veterans by lengths gained.
_Avoid_: ace (when it is a finished run rather than the one about to be trained)

**Target stats**:
The stat line the user aims for when training the Ace, entered on top of a recommended default. The untrained Ace has no real stats, so skill value is measured on a runner with these.
_Avoid_: ace stats (the Ace has none before its run)

**Running style**:
How the runner paces a race, named as on Global: Front Runner (nige), Pace Chaser (senko), Late Surger (sashi), End Closer (oikomi). Internal ids stay nige/senko/sashi/oikomi; lineage `goals.ts` uses shorter Front/Pace/Late/End labels internally.
_Avoid_: nige/senko/sashi/oikomi (in UI copy), strategy

**Spark**:
An inheritable bonus on a veteran, passed to the trainee. Pink sparks raise an aptitude, blue sparks raise a stat, green sparks give a unique skill, white sparks give general skills.
_Avoid_: factor

**Affinity**:
How compatible a trainee and its lineage are; it raises spark chance. Dirt sparks are kept in the core loop for this reason.
_Avoid_: compatibility (in UI copy)

**Tier list**:
The user's configurable ranking of general sparks, used in the core loop to decide which are worth keeping.

**Proc**:
A skill activating in a simulated race. Proc % is the share of runs in which it did.
_Avoid_: trigger

**Lengths gained**:
How far ahead a skill puts the runner, in race lengths, measured over runs where it procced. Skill value is proc % x median lengths gained.
_Avoid_: bashin (in UI copy)

**Paired race**:
The same runner and seed raced twice, once without and once with the skills, with the gap measured when the first of them finishes. Skill value and Set lengths gained are both read off paired races.

**Set lengths gained**:
The median lengths gained by a veteran's whole equipped skill set together, over all runs whether or not each skill procced. The Ace veteran headline and ranking use it.
_Avoid_: lengths gained (when meaning the whole set; that term is per skill, over runs where it procced)

**CM preset**:
The course, season and conditions of a specific Champions Meeting, used to pick the course and rank styles.

**Candidate pool**:
Every outfit available on Global, owned or not, that can be recommended. Owned outfits are marked.
