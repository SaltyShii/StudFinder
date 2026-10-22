import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { STYLE_LABEL } from '../../../packages/scoring/src/ace';
import { surfaceStarsOf, type LineageHorse } from '../../../packages/scoring/src/shared';
import type { AcePick, Candidate, CandidatePick, OwnedVersion } from '../../../packages/scoring/src/recommend';
import { SkillDetails, UmaCard } from './UmaCard';

interface Props {
	/** Best first. */
	picks: AcePick[] | undefined;
	/** Card id of the hero whose chart is shown; each hero gets a button to select it. */
	selected?: number;
	onSelect?: (cardId: number) => void;
	data: GameData;
	stale: boolean;
}

export function nameOf(data: GameData, id: number) {
	const c = data.cards.get(id);
	return c ? versionName(c) : String(id);
}

/** Parent cards with their inherited skills and the parent's own two parents (the Ace's grandparents). */
export function ParentCards({ parents, byId, cardIds, data, testId }: { parents: CandidatePick[]; byId: Map<string, Candidate>; cardIds: Map<string, number>; data: GameData; testId: string }) {
	return <>{parents.map((p) => <UmaCard testId={`${testId}-parent`} cardId={cardIds.get(p.candidateId)} name={byId.get(p.candidateId)?.name ?? p.candidateId} headline={p.score.toFixed(2)}>
		<SkillDetails detail={p.detail} data={data} open />
		<div class="cards">{byId.get(p.candidateId)?.horses.slice(1).map((g) => <img class="portrait" data-testid={`${testId}-grandparent`} alt={g.cardId == null ? "" : nameOf(data, g.cardId)} src={`${import.meta.env.BASE_URL}img/cards/${g.cardId}.png`} />)}</div>
	</UmaCard>)}</>;
}

/** The candidates of an Owned version by id, to look the picked parents up. */
export function parentsById(ownedVersions: OwnedVersion[], cardId: number): Map<string, Candidate> {
	return new Map(ownedVersions.find((v) => v.cardId === cardId)?.candidates.map((c) => [c.id, c]));
}

/** Distance and surface aptitude sparks are all pink; stat sparks are not shown. */
function SparkChips({ horse }: { horse: LineageHorse }) {
	const pink = [['Distance', horse.pinkStars], ['Turf', surfaceStarsOf(horse, 'turf')], ['Dirt', surfaceStarsOf(horse, 'dirt')]] as const;
	return <div class="chips">
		{pink.filter(([, n]) => n > 0).map(([label, n]) => <span class="chip chip-pink">{label} {n}</span>)}
	</div>;
}

function TreeNode({ horse, testId, data }: { horse: LineageHorse; testId: string; data: GameData }) {
	const name = horse.cardId == null ? '' : nameOf(data, horse.cardId);
	return <div class="tree-node" data-testid={testId}>
		<img class="portrait" alt={name} src={`${import.meta.env.BASE_URL}img/cards/${horse.cardId}.png`} />
		<span class="tree-name">{name}</span>
		<SparkChips horse={horse} />
	</div>;
}

/** The Ace on top, its 2 parents and below each parent its own 2 grandparents; pink spark chips (distance, turf, dirt) sit on every horse but the Ace, so a lineage lacking the right pink sparks stands out. */
export function LineageTree({ pick, data }: { pick: AcePick; data: GameData }) {
	return <div class="lineage-tree" data-testid="lineage-tree">
		<div class="tree-node tree-ace" data-testid="tree-ace">
			<img class="portrait" alt="" src={`${import.meta.env.BASE_URL}img/cards/${pick.cardId}.png`} />
			<span class="tree-name">{nameOf(data, pick.cardId)}</span>
		</div>
		<div class="tree-parents">{pick.horses.map(([parent, ...grandparents]) => <div class="tree-branch">
			<TreeNode horse={parent} testId="tree-parent" data={data} />
			<div class="tree-grandparents">{grandparents.map((g) => <TreeNode horse={g} testId="tree-grandparent" data={data} />)}</div>
		</div>)}</div>
	</div>;
}

/** The best Ace heroes as a compact list: name, running style, expected lengths. */
export function AceHero({ picks, selected, onSelect, data, stale }: Props) {
	const selectedPick = picks?.find((p) => p.cardId === selected);
	return (
		<section class="panel" aria-busy={stale}>
			<h3>Ace{stale && ' (outdated, recomputing)'}</h3>
			<ol class="hero-list" style={stale ? { opacity: 0.5 } : undefined}>
				{picks?.map((pick) => (
					<li class="hero-row" data-testid={`ace-pick-${pick.cardId}`} data-selected={pick.cardId === selected || undefined}>
						<strong>{nameOf(data, pick.cardId)}</strong>
						<span class="muted">{STYLE_LABEL[pick.style]}{pick.fallback && ' (fall-back style: not the selected one)'}</span>
						<span class="headline" data-testid="hero-lengths">{pick.expectedLengths.toFixed(2)} lengths</span>
						{onSelect && <button class="select-pick" data-testid={`ace-select-${pick.cardId}`} aria-pressed={pick.cardId === selected} onClick={() => onSelect(pick.cardId)}>{pick.cardId === selected ? 'Skills shown below' : 'Show skills'}</button>}
					</li>
				))}
			</ol>
			{selectedPick && <LineageTree pick={selectedPick} data={data} />}
		</section>
	);
}
