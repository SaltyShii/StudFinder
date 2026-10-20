# Race mechanics reference

Condensed from "Uma Musume Race Mechanics" by KuromiAK ([Google Doc](https://docs.google.com/document/d/15VzW9W2tXBBTibBRbZ8IVpW6HaMX8H0RP03kq6Az7Xg)), itself built on reverse engineering by @umamusu_reveng, @kak_eng, @hoffe_33 and the simulators of Aya, kakku and Tunnelblick. Not guaranteed correct; server differences are noted in the source. Snapshot read 2026-10-18 from the PDF export (the Google text export drops the formulas). Wiz = wisdom, Oonige = runaway; stat names below mean the final stat unless noted.

For where `packages/sim` agrees or drifts, see [Verification](#verification-against-packagessim). For what was checked against the game client itself, and the fixes that came out of it, see [Client verification](#client-verification-global-steam-client-2026-10-18).

## Concepts

- Tick = 1/15 s (0.0666 s). Per frame, umas update in gate order: end-of-corner check → activate skills → HP recovery → last spurt state → target speed → acceleration → phase → distance → slope.
- 24 equal sections. Phases: 0 early (1-4), 1 mid (5-16), 2 late (17-20), 3 last spurt phase (21-24). "Last spurt" the mechanic is separate from phase 3.
- Skill activation is checked before the phase updates; `remain_distance` uses floor(position); skills trigger in ID order (lower ID can trigger higher on the same frame, not the reverse).

## Formulas

Speed and acceleration
- `BaseSpeed = 20 − (distance − 2000)/1000`
- `BaseTargetSpeed (early/mid) = BaseSpeed × StrategyPhaseCoef`; late+ adds `sqrt(500 × Speed) × DistProf × 0.002`
- `TargetSpeed = (BaseTargetSpeed | LastSpurtSpeed) × PosKeepCoef + ForceIn + Skill + Slope + MoveLane`; clamp to [MinSpeed, 30]
- `LastSpurtSpeedMax = (BaseTargetSpeed[late] + 0.01 × BaseSpeed) × 1.05 + sqrt(500 × Speed) × DistProf × 0.002 + (450 × Guts)^0.597 × 0.0001`
- Last spurt candidate accept chance: `15 + 0.05 × Wiz` %
- `MinSpeed = 0.85 × BaseSpeed + sqrt(200 × Guts) × 0.001`; start dash ends at `0.85 × BaseSpeed`, adds 24 m/s²
- `Accel = BaseAccel × sqrt(500 × Power) × StrategyPhaseCoef × GroundProf × DistProf + Skill + StartDash`; `BaseAccel` 0.0006 (0.0004 uphill)
- Deceleration: early −1.2, mid −0.8, late −1.0, pace down −0.5, out of HP −1.2 m/s²
- Section randomness: `max = Wiz/5500 × log10(Wiz × 0.1)` %, `min = max − 0.65` %, times BaseSpeed
- Uphill: target speed −`SlopePer × 200/Power` (SlopePer in %). Downhill accel mode: chance/s `Wiz × 0.04`%, target speed **+`0.3 + |SlopePer|/10`**, 20%/s exit.
- Force-in: `Random(0.1) + {FR 0.02, PC 0.01, LS 0.01, EC 0.03}`; move lane: `sqrt(0.0002 × Power)`.
- Blocked in front: speed ≤ `(0.988 + 0.012 × gap/2m) × blockerSpeed`.

HP
- `MaxHP = 0.8 × StrategyCoef × Stamina + distance`
- `HP/s = 20 × (CurrentSpeed − BaseSpeed + 12)² / 144 × Status × Downhill × Ground`, × `1 + 200/sqrt(600 × Guts)` in late-race+

Skills
- `ActivationChance = max(100 − 9000/BaseWiz, 20)` %; `Duration = BaseDuration × distance/1000` (same for cooldown).
- `MultiplySkillNum = min(1 + 0.01 × NumSkill, 1.2)`; `MultiplyDistanceDiffTop` duration `× min(0.8 + gapToTop/62.5, 1.6)`.
- Wiz limit break: `ValueIncrease = BaseValue × PhaseStrategyCoef × WizMultiplier`.

Position keeping and states
- Pace thresholds with `CourseFactor = 0.0008 × (length − 1000) + 1`: Pace Chaser 3.0 / 5.0×CF; Late Surger 6.5×CF / 7.0×CF; End Closer 7.5×CF / 8.0×CF. Pace down exit max = `lerp(min, max, 0.5)` in mid-race.
- Mode entry chance: speed up and overtake `20 × log10(0.1 × Wiz)`%, pace up `15 × log10(0.1 × Wiz)`%.
- Rushed: `(6.5/log10(0.1 × Wiz + 1))²` %.
- Spot struggle (150 m travelled, gap <3.75 m and <0.165 course width): target speed `+(500 × Guts)^0.6 × 0.0001`; duration `sqrt(700 × Guts) × 0.012 × StrategyProficiency` s; leave at >5 m or >0.416 width apart.
- Dueling (final straight, gap <3 m, <0.25 width, speed gap <0.6 m/s, 2 s): target speed `+(200 × Guts)^0.708 × 0.0001`, accel `+(160 × Guts)^0.59 × 0.0001`.
- Lane: target speed `0.02 × (0.3 + 0.001 × Power) × FirstMoveLaneMod × OrderMod`; accel `0.03`; actual speed clamped to 0.6.

Late-game mechanics
- Conserve power: `PowerStat = BasePower + 0.5 × max(RawPower − 1200, 0) + Skill`; credit per second `PosKeepCoef (4.2 normal, 6.7 pace down) × StyleCoef (1, 0.75, 1, 0.7)`; release `Accel = sqrt((PowerStat − 1200) × 130) × 0.001 × StrategyDistanceCoef × ActivityCoef`, `Duration = Conserved × sqrt(distance) × DistanceTypeCoef/1450`.
- Stamina limit break: `TargetSpeedBuff = sqrt(Stamina − 1200) × 0.0085 × DistanceFactor × RandomFactor`.
- Zenkai spurt: `Accel ≈ 0.068 × AccelFromPower / (distance/1000)^1.5 + Skill`.
- Compete before spurt: `((Power/1500)^0.5 × 2 + (Guts/3000)^0.2) × 0.1 × StrategyCoef`; stamina cost `20 × (StrategyCoef × DistCoef + NearFactor)`. Secure lead: desirable lead `StrategyCoef + 0.0003 × (distance + 1000)`, speed `(Guts/2000)^0.5 × 0.3 × StrategyCoef`. Stamina keep chance `30% × (Wiz/1000 + Wiz)^0.03` (speculative).
- Displayed time = actual × 1.18.

## Stats

- Raw stat clamp 1-2000 (caps removed at 5th anniversary). Raw stats above 1200 are halved before becoming base stats.
- Motivation: 絶好調 1.04, 好調 1.02, 普通 1.0, 不調 0.98, 絶不調 0.96. Base stat = raw × motivation.
- Adjusted stat = base stat + modifiers: ground, strategy proficiency (wiz), race course, single mode (+400).
- Ground speed modifier: heavy (不良) −50 on both surfaces, else 0. Ground power modifier: turf good/soft/heavy −50; dirt firm −100, good −50, soft −100, heavy −100.
- Strategy proficiency S..G: 1.1 1.0 0.85 0.75 0.6 0.4 0.2 0.1.
- Race course modifier: per threshold stat, base stat ≤300 +0.05, ≤600 +0.1, ≤900 +0.15, >900 +0.2; average over threshold stats; applied to speed.

## Speed

- Start: 3 m/s; start delay uniform up to 0.1 s (not wiz-dependent; >0.08 s = late start). Start dash adds acceleration until a speed threshold.
- Base speed = 20 − (distance − 2000)/1000.
- Strategy phase coefficient (early / mid / late+spurt), target speed:

| | Early | Mid | Late+ |
|---|---|---|---|
| Front Runner | 1.0 | 0.98 | 0.962 |
| Pace Chaser | 0.978 | 0.991 | 0.975 |
| Late Surger | 0.938 | 0.998 | 0.994 |
| End Closer | 0.931 | 1.0 | 1.0 |
| Oonige | 1.063 | 0.962 | 0.95 |

- Speed stat only affects target speed from late-race on. Distance proficiency S..G (speed): 1.05 1.0 0.9 0.8 0.6 0.4 0.2 0.1.
- Per-section randomness added to target speed, scaled by wiz (400 wiz: −0.533%..+0.117%; 800: −0.373%..+0.277%); not applied in last spurt.
- Last spurt speed/distance is chosen on entering late-race (guts term added after 1st anniversary). Enough HP → spurt at max speed. Otherwise candidates step down 0.1 m/s, sorted by finish time, each accepted with a wiz-dependent chance; fallback is the slowest. HP estimate stops 60 m before the goal; a HP recovery skill after late-race entry triggers a recalculation (debuffs do not).
- Minimum speed depends on guts; it is the target when out of HP, and applies after the start dash.
- Blocked in front: speed capped at 0.988× (0 m gap) to 1.0× (2 m gap) of the blocker.
- Slope (post-1st-anniversary course events): uphill reduces target speed; downhill gives a per-second chance to enter downhill accel mode (+target speed, −60% HP use, 20%/s exit).

## Acceleration

- Strategy phase coefficient (early / mid / late+):

| | Early | Mid | Late+ |
|---|---|---|---|
| Front Runner | 1.0 | 1.0 | 0.996 |
| Pace Chaser | 0.985 | 1.0 | 0.996 |
| Late Surger | 0.975 | 1.0 | 1.0 |
| End Closer | 0.945 | 1.0 | 0.997 |
| Oonige | 1.17 | 0.94 | 0.956 |

- Ground proficiency S..G: 1.05 1.0 0.9 0.8 0.7 0.5 0.3 0.1. Distance proficiency S..G: 1.0 ×5 (S-D), then 0.6 0.5 0.4 (E-G).
- Uphill uses a lower base acceleration.

## HP

- Max HP from stamina and strategy coefficient: Front Runner 0.95, Pace Chaser 0.89, Late Surger 1.0, End Closer 0.995, Oonige 0.86.
- Consumption status multipliers: Front Runner spot struggle + rushed 3.6×, Oonige 7.7×; spot struggle alone 1.4× / 3.5× (Oonige); rushed 1.6×; pace down 0.6×; downhill accel mode 0.4×.
- Ground HP modifier (firm / good / soft / heavy): turf 1 1 1.02 1.02; dirt 1 1 1.01 1.02.
- Late-race and last spurt multiply consumption by a guts modifier (200 guts 1.577×, 400 1.408×, 600 1.333×).
- Recovery skills restore a percentage of max HP, capped at max. Out of HP → target speed = minimum speed.

## Skills

- Wiz check before the race, on base wiz (not strategy proficiency, not skills): 300 → 70%, 600 → 85%, 900 → 90%, 1200 → 92.5%.
- Duration and cooldown scale with course distance.
- Level scaling (level 1 → 10): target speed 1.00 → 1.25 (1.01 at L2, then +0.03/level); accel 1.00 → 1.20; stat skills 1.00 → 1.10 (+0.01/level); everything else (recovery, current speed, lane move) 1.00 → 1.18 (+0.02/level).
- Random-position conditions pick a 10 m segment before the race (`x_random`); straights chosen uniformly regardless of length; `all_corner_random` places up to 4 triggers across corners; `phase_corner_random` stitches a phase's corners.
- Skills do not distinguish friend or foe for targeting; teammates are excluded from debuffs.
- Value scalings (aoharu, climax, MultiplySpeed, etc.) and duration scalings (remain HP, order up, blocked time) are scenario/unique-skill specific; thresholds are in the source doc.
- Wiz Limit Break Buff (5th anniversary): with wiz above 1200, unique/evolved/gold target-speed (27) and current-speed-with-natural-decel (22) skills gain extra effect from a threshold table keyed on wiz − 1200 (0 at ≤20 over, 0.2 at 201, 0.8 at 401, 1.0 at 801, 1.12 at 1901+), times a phase strategy coefficient. The activator's wiz counts.

## Position keeping (sections 1-10)

| Mode | Target speed ×|
|---|---|
| Normal | 1.0 |
| Speed up (front runner, leading <4.5 m; 17.5 m Oonige; 12.5 m if the sole front runner) | 1.04 |
| Overtake (front runner not leading its strategy) | 1.05 |
| Pace up (non-front, too far from pacemaker) | 1.04 |
| Pace down (non-front, too close) | 0.945 mid-race (post 1.5 anniv.), 0.915 otherwise |
| Pace up Ex (strategy order violated; post 1.5 anniv.) | 2.0 |

Checks every 2 s with a wiz roll; a mode lasts at most 1 section (3 for Oonige), then a 1 s cooldown.

## Rushed (kakari)

- Rolled before the race; chance falls with wiz (300 wiz 19%, 600 14%, 900 12%, 1200 10%, rounded up to an integer %). 自制心 subtracts a flat 3%.
- Enters in a random section 2-9. Forces position keep strategy change and wiz rolls to succeed. Every 3 s a 55% chance to snap out; hard end at 12 s.

## Competition and spurt mechanics

- **Spot struggle**: Front Runners (or Oonige) near each other early (before section 6/9); extra target speed from guts; ends at section 9.
- **Dueling**: final straight, candidates within range for 2 s, both ≥15% HP; speed and acceleration from guts; exits below 5% HP.
- **Conserve power / release**: only with >1200 power; credit earned over sections 1-10, reduced by spot struggle (×0.95) and rushed (×0.8); released as extra acceleration on entering last spurt. Strategy-distance coefficient (short/mile/mid/long): Front 1/1/1/1, Pace 0.7/0.8/0.9/0.9, Late 0.75/0.7/0.875/1.0, End 0.7/0.75/0.86/0.9.
- **Compete before spurt, secure lead, stamina keep**: sections 11-15, inferred from the parameter file only, details uncertain.
- **Stamina limit break**: base stamina + skills >1200 → target speed buff on reaching max spurt speed. Distance factor: <2101 m 0×, <2201 0.5×, <2401 1.0×, <2601 1.5×, ≥2601 1.8× (1.2× / 1.5× before 2024-10-29).
- **Zenkai spurt**: >2000 speed, enough HP → continued acceleration after reaching spurt speed; speed drops to minimum when HP runs out (known bug).

## Lanes, blocking, vision

- 1 course width = 11.25 m; 1 horse lane = 1/18 course width. Lane target modes: normal, overtake (targets 1-20 m ahead, catchable in 15 s), fixed (skill-driven). Extra move lane applies from the final corner (before 1st anniversary: final straight).
- Overlapping umas bump the outer one 0.4 horse lane. Vision starts at 20 m.
- Running wide or diagonally covers more ground (course distance to world transform ratio vs base ratio 0.96-1.06).

## Finish time and popularity

Finish time is interpolated within the last frame; displayed time is bounded per course. Margins: nose 0.2 m, head 0.4 m, neck 0.8 m at 15 m/s. Popularity uses a three-judge standardised score (formulas in the source doc).

## Verification against packages/sim

Checked 2026-10-18 against `packages/sim/src`, formulas included.

**Matches**
- Strategy phase coefficients (speed, accel), proficiency tables, ground modifiers, base/target/last-spurt speed incl. guts term, min speed, start dash, deceleration (incl. pace down −0.5, out of HP −1.2), base accel.
- HP: max HP, per-second formula, status and ground modifiers, guts modifier; last spurt 60 m reserve and candidate accept chance.
- Skill level scaling, wiz check on raw wiz, raw stat halving, motivation, section randomness, rushed chance and timers, position keep chances (20/15 × log10), spot struggle target speed, dueling speed and accel, lane change speed, uphill penalty, downhill trigger chance, move lane modifier, conserve power strategy-distance table.

**Drifts**
Fixed in 6f201a3 (see Client verification): downhill accel mode sign, stamina limit break distance factors, pace down 0.945 mid-race. Fixed from the PDF: spot struggle duration x StrategyProficiency, rushed chance rounded up to a whole percent (#58); conserve power rebuilt (#59, `ConservePower.ts`; ActivityCoef 1, DistanceTypeCoef 1, credit scaled by 0.95/0.8). No open drifts.

**Not implemented**
- Wiz limit break buff (wiz above 1200) and zenkai spurt (speed above 2000): deferred, JP-only mechanics not yet in Global.
- Pace up Ex, blocking speed cap, overtake lane logic, compete before spurt, secure lead, stamina keep.
- Stamina limit break random factor (fixed 1.0) and its input uses unhalved stamina; the doc says base stamina (halved). Unverified.

## Client verification (Global Steam client, 2026-10-18)

Checked against the game's own code and live parameter values (Unity 2022.3.62f2, IL2CPP, `GameAssembly.dll` dumped from the running game). Method and evidence live in the private `uma-re` notes; this section keeps only what the sim needs. The single-uma sim does not model other runners, lanes or blocking, so anything that needs them is out of scope here.

### Fixes to make in `packages/sim`

Ordered by impact. All five depend only on the uma's own stats, the course and the RNG.

1. **Pace down speed** (`RaceSolver.ts`, `posKeepSpeedCoef` for `PaceDown`): `0.945` when in the mid-race phase, `0.915` in every other phase. The client picks between two parameters by phase. Currently `0.915` everywhere.
2. **Downhill accel mode** (`RaceSolver.ts` ~L1215): the client uses `|slope|`: `0.3 + |slope|/10`. The sim adds `0.3 + slopePer/100000` with a negative `slopePer`, so steeper hills give less. Use `Math.abs(this.slopePer)` and keep the sim's own slope units consistent with the doc's `|%|/10`.
3. **Last spurt candidate list** (`SpurtCalculator.ts` ~L204): the client builds candidates from max speed downwards in 0.1 m/s steps (max, max-0.1, ...) while the speed is at least the late-race base target speed, capped at 100 steps. The sim steps upwards from base speed, which puts the candidate speeds on a different grid and usually drops the max-speed candidate. Sorting by finish time and the `15 + 0.05 * wiz` % accept chance are already right.
4. **Target speed clamp**: final target speed is clamped to `[13.0, 30.0]` m/s (`Speed.TargetSpeedMin = 13.0`, `30.0` hard-coded). The sim clamps below with the guts-based `minSpeed` (~17 m/s) and has no upper cap. Use `13.0` and `30.0` for target speed; keep `minSpeed` for current speed. When HP is out, the target speed is replaced by the out-of-HP speed first (the sim already does this).
5. **Stamina limit break distance factor** (`RaceSolverBuilder.ts`, `StaminaSyoubu.distanceFactor`): 2401-2600 m is `1.5x`, 2601 m and up is `1.8x`. Not in the client (see below), so this comes from the source doc.

### Confirmed correct (no change)

Values read from the live client; all equal the doc and the sim.

- Randomness per section: `log10(0.1*wiz) * wiz/5500` max, min offset `-0.65`, applied as a percent of race base speed.
- Last spurt max speed: `(lateBaseTargetSpeed + 0.01*baseSpeed)*1.05 + sqrt(500*speed)*distProf*0.002 + (450*guts)^0.597*0.0001`; 60 m goal buffer; candidates capped to 100.
- Position keep: speed up `1.04`, overtake `1.05`, pace up `1.04`, pace up Ex `2.0`; entry chances `20 * log10(0.1*wiz)` % and `15 * ...`; end distances `4.5` / `17.5` m, overtake end `10` / `27.5` m; pace thresholds and course factor `0.0008*(distance-1000)+1`.
- Rushed: `(6.5 / log10(0.1*wiz + 1))^2` %, sections 2-9, 55 % snap-out every 3 s, 12 s cap, style-change odds.
- HP: `20 * ((speed - baseSpeed + 12)^2 / 144)`, guts factor `1 + 200/sqrt(600*guts)` in the late phases, strategy max-HP coefficients, rushed / pace-down / downhill / compete-top drain multipliers.
- Uphill `-|slope| * 200 / pow`; downhill entry chance `min(100, wiz * 0.04)` % per second, end chance 20 %.
- Start delay `U(0, 0.1)`, late start above `0.08`, start dash accel `+24`, start speed `3.0`, lane change speed `0.02*(0.3 + 0.001*pow)`, block front `0.988` to `1.0` at 0 to 2 m.

### Not in the client (source doc only)

Stamina limit break (including its random factor), wiz limit break, zenkai spurt, compete before spurt, secure lead, stamina keep, conserve power, spot struggle and dueling internals. The client has no code or parameters for these (the conserve power and compete calculators are null stubs), so they stay as documented in the source doc. For the stamina limit break random factor the doc's table is the only source; it is server-side data.

### Out of scope for a single-uma sim

Force-in modifier (needs a blocked inside), the one-front-runner `12.5` m speed-up end distance, lane scoring and overtake candidates, blocking speed caps, and the ~40 skill conditions that depend on other runners (near count, temptation counts, distance-diff-top and similar). Skills that need blocking should be flagged unreliable in the UI with a note that they require being blocked.
