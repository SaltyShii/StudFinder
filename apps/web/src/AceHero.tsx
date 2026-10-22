import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { APTITUDE_LABEL, gradeLabel, STYLE_LABEL } from '../../../packages/scoring/src/ace';
import type { AcePick, Candidate, CandidatePick, OwnedVersion } from '../../../packages/scoring/src/recommend';
import { SkillDetails, UmaCard } from './UmaCard';

interface Props {
	/** Best first. */
	picks: AcePick[] | undefined;
	/** Card id of the hero whose chart is shown; each hero gets a button to select it. */
	selected?: number;
	onSelect?: (cardId: number) => void;
	data: GameData;
	ownedVersions: OwnedVersion[];
	/** Trained id to card id, for the parents' portraits. */
	cardIds: Map<string, number>;
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

/** Style first, then every aptitude with its grade. */
function aptitudeChips(data: GameData, pick: AcePick): string[] {
	return [STYLE_LABEL[pick.style], ...Object.entries(data.cards.get(pick.cardId)?.aptitudes ?? {}).map(([k, v]) => `${APTITUDE_LABEL[k] ?? k} ${gradeLabel(v)}`)];
}

/** Parent cards as a pick list for the game: portrait, name and the Ace's grandparents only. `heroId` keeps the test ids of one hero's cards apart from the others'. */
export function ParentPickList({ parents, byId, cardIds, data, heroId }: { parents: CandidatePick[]; byId: Map<string, Candidate>; cardIds: Map<string, number>; data: GameData; heroId: number }) {
	return <>{parents.map((p) => <UmaCard testId={`ace-parent-${heroId}`} cardId={cardIds.get(p.candidateId)} name={byId.get(p.candidateId)?.name ?? p.candidateId} headline={null}>
		<div class="cards">{byId.get(p.candidateId)?.horses.slice(1).map((g) => <img class="portrait" data-testid={`ace-grandparent-${heroId}`} alt={g.cardId == null ? "" : nameOf(data, g.cardId)} src={`${import.meta.env.BASE_URL}img/cards/${g.cardId}.png`} />)}</div>
	</UmaCard>)}</>;
}

/** The best Ace heroes, each with version, running style, 2 parents. Grandparents are the parents' own two parents. */
export function AceHero({ picks, selected, onSelect, data, ownedVersions, cardIds, stale }: Props) {
	return (
		<section class="panel" aria-busy={stale}>
			<h3>Ace{stale && ' (outdated, recomputing)'}</h3>
			{picks?.map((pick) => (
				<div class="hero-pick" data-selected={pick.cardId === selected || undefined}>
					<ol class="cards" style={stale ? { opacity: 0.5 } : undefined}>
						<UmaCard testId={`ace-pick-${pick.cardId}`} cardId={pick.cardId} name={nameOf(data, pick.cardId)} headline={pick.score.toFixed(2)} chips={aptitudeChips(data, pick)} caveats={pick.fallback ? ['Fall-back style: not the selected one'] : []} />
						<ParentPickList parents={pick.parents} byId={parentsById(ownedVersions, pick.cardId)} cardIds={cardIds} data={data} heroId={pick.cardId} />
					</ol>
					{onSelect && <button class="select-pick" data-testid={`ace-select-${pick.cardId}`} aria-pressed={pick.cardId === selected} onClick={() => onSelect(pick.cardId)}>{pick.cardId === selected ? 'Skills shown below' : 'Show skills'}</button>}
				</div>
			))}
		</section>
	);
}
