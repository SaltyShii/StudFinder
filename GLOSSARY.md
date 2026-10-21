# Lineage Training

Recommending which umas a player should train next, as parents in a lineage, for an upcoming Champions Meeting (CM).

## Language

**Uma**:
A character, e.g. one trainable horse girl, independent of which version of her is used.
_Avoid_: horse, character (when the version matters)

**Version**:
A specific release of an uma (e.g. one of Oguri Cap's two) with its own aptitudes, skills and rarity. The game data calls it a card.
_Avoid_: outfit, skin, variant, card (clashes with support cards)

**Veteran**:
A completed training run of an uma, owned by the player, carrying sparks and parents of its own.
_Avoid_: save, build

**Roster**:
The veterans a player imported from an export, persisted between sessions.

**Parent**:
A veteran placed directly above the trainee in a lineage.

**Grandparent**:
A parent's parent in a lineage.

**Great-grandparent**:
A grandparent's parent in a lineage; no official game name.
_Avoid_: ggp (in prose; abbreviation only)

**Core loop**:
The long-lived foundation line of great-grandparents, kept strong across CMs by preserving high-tier general sparks, ranked by the Tier list weight of the sparks across the whole lineage. It has its own running style (default: the Sim runner's) and keeps that style's specific skills, but ignores skills conditioned on surface, distance or track. A great-grandparent must carry dirt sparks (a requirement, not something to maximise): they raise the dirt aptitude of the grandparents built from it, which lifts affinity the most.

**Side loop**:
Grandparents and parents built specifically for one upcoming CM, ranked by spark % of the Must-have skills plus the CM's relevant pink spark, so they can later become parents of the Ace. The track's best simulated skills only break ties.

**Ace**:
The final trainee run for the CM, picked from the Owned versions together with its best 2 parents and 4 grandparents for the selected track. It ranks by the inheritance chance of the Must-have skills, ties broken by the simulated value of the track's best skills.
_Avoid_: trainee (when meaning the final CM runner)

**Ace veteran**:
A veteran scored as a CM runner as herself, in the running style she ran in her career, with her actual stats and equipped skills. Ranked against other Ace veterans by lengths gained.
_Avoid_: ace (when it is a finished run rather than the one about to be trained)

**Sim runner**:
The uma every simulation runs against, chosen by the user, with its running style and Target stats. It is a measuring stick, not a recommendation: the Ace is picked separately.
_Avoid_: ace (for this selector)

**Owned version**:
A version the user marks as owned, taken with its default aptitudes and skills (no configuration). The Ace slot scores every owned version, since their unique skills and aptitudes differ per track.

**Must-have skill**:
A skill the user decides manually the lineage should pass on. One shared list: the Ace slot ranks lineages by the best inheritance chance of these, and the side loop by their spark %. The core loop ignores it.

**Target stats**:
The stat line the user aims for on the Sim runner, entered on top of a recommended default. Skill value is measured on a runner with these.
_Avoid_: ace stats (the Ace has none before its run)

**Running style**:
How the runner paces a race, named as on Global: Front Runner (nige), Pace Chaser (senko), Late Surger (sashi), End Closer (oikomi). Internal ids stay nige/senko/sashi/oikomi; lineage `goals.ts` uses shorter Front/Pace/Late/End labels internally.
_Avoid_: nige/senko/sashi/oikomi (in UI copy), strategy

**Aptitude grade**:
How well a veteran suits a surface, distance or running style, from G (lowest) to S (highest). The data stores it as a number 1–8; the letter is what the player sees and what the race sim takes.
_Avoid_: rank, rating

**Spark**:
An inheritable bonus on a veteran, passed to the trainee. Pink sparks raise an aptitude, blue sparks raise a stat, green sparks give a unique skill, white sparks give general skills.
_Avoid_: factor

**Affinity**:
How compatible a trainee and its lineage are; it raises spark chance.
_Avoid_: compatibility (in UI copy)

**Tier list**:
The user's configurable ranking of general sparks, one per running style, used in the core loop to decide which are worth keeping. The user can move a skill between tiers or disable it; edits persist.

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

**Activation spot**:
Where on the track a skill procced in a simulated run. Over many runs the spots form a spread along the distance, which the Track overview draws for each skill.
_Avoid_: fire point, trigger point

**Track overview**:
The chart of the selected CM's course (speed of a neutral baseline runner, slope, straights and corners, phases, sections) with each Ace skill's activation spots and effect length drawn on it. Only the Ace slot has one; the side loop judges skills by spark % and value alone.

**Baseline runner**:
A neutral runner with no skills, used only to draw the speed curve of the Track overview (start dash, end of pace-down, last spurt kick). Not any veteran.

**Sim assumptions**:
The race conditions the simulator assumes for every score (wit check, rushing, spot struggle, dueling with a rate per running style, lane movement), each switchable by the user. Defaults match umalator's where umalator has the option (dueling, which it lacks, defaults off); they apply to all slots. Sync RNG is not an option (the paired race always shares its seed) and position keep is left out (the paired race runs no pacemaker).

**CM preset**:
The course, season and conditions of a specific Champions Meeting, used to pick the course and rank styles.

**Borrowed veteran**:
A friend's veteran you borrow as a parent; the game allows 5 borrows a day. Scored like any other veteran.
_Avoid_: rental

**Slot**:
A place in the lineage a recommendation fills: the Ace veteran, the core loop or the side loop.

**Pick**:
A candidate ranked for a slot, with its score, the reason and the skill detail behind it.

**Candidate**:
A veteran considered as a parent. It brings itself and its own two parents (the Ace's grandparents), and all three inspire with their own sparks and affinity. Only veterans are scored: a version you have not trained does not exist as a parent.
