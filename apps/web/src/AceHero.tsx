import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { gradeLabel, STYLE_LABEL } from '../../../packages/scoring/src/ace';
import type { AcePick, AceSkillRow, Candidate, CandidatePick, OwnedVersion } from '../../../packages/scoring/src/recommend';
import { SkillDetails, UmaCard } from './UmaCard';

interface Props {
	pick: AcePick | null | undefined;
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

/** Parent cards as a pick list for the game: portrait, name and the Ace's grandparents only. */
export function ParentPickList({ parents, byId, cardIds, data }: { parents: CandidatePick[]; byId: Map<string, Candidate>; cardIds: Map<string, number>; data: GameData }) {
	return <>{parents.map((p) => <UmaCard testId="ace-parent" cardId={cardIds.get(p.candidateId)} name={byId.get(p.candidateId)?.name ?? p.candidateId} headline={null}>
		<div class="cards">{byId.get(p.candidateId)?.horses.slice(1).map((g) => <img class="portrait" data-testid="ace-grandparent" alt={g.cardId == null ? "" : nameOf(data, g.cardId)} src={`${import.meta.env.BASE_URL}img/cards/${g.cardId}.png`} />)}</div>
	</UmaCard>)}</>;
}

/** Every skill the Ace can end up with. Rows resting on the default position assumption are greyed and marked `*`. */
export function AceSkillRows({ rows, data, parentNames }: { rows: AceSkillRow[]; data: GameData; parentNames: Map<string, string> }) {
	if (!rows.length) return null;
	return (
		<ul class="ace-skills">{rows.map((r) => (
			<li data-testid="ace-skill-row" class={r.assumesPosition ? 'muted' : undefined} style={r.mustHave ? { fontWeight: 'bold' } : undefined} data-must-have={r.mustHave || undefined}>
				{data.skills.get(Number(r.skillId))?.name ?? r.skillId}{r.assumesPosition && ' *'}: {r.lengths.avg.toFixed(2)} avg lengths, {r.proc.toFixed(0)}% proc, {(r.inherit * 100).toFixed(0)}% inherited{r.parentId != null && ` from ${parentNames.get(r.parentId) ?? r.parentId}`}
			</li>
		))}</ul>
	);
}

/** The best Ace: version, running style, 2 parents. Grandparents are the parents' own two parents. */
export function AceHero({ pick, data, ownedVersions, cardIds, stale }: Props) {
	const version = pick && ownedVersions.find((v) => v.cardId === pick.cardId);
	const byId = new Map(version?.candidates.map((c) => [c.id, c]));
	return (
		<section class="panel" aria-busy={stale}>
			<h3>Ace{stale && ' (outdated, recomputing)'}</h3>
			{pick && (
				<ol class="cards" style={stale ? { opacity: 0.5 } : undefined}>
					<UmaCard testId="ace-pick" cardId={pick.cardId} name={nameOf(data, pick.cardId)} headline={pick.score.toFixed(2)} chips={[STYLE_LABEL[pick.style], ...Object.entries(data.cards.get(pick.cardId)?.aptitudes ?? {}).map(([k, v]) => `${k} ${gradeLabel(v)}`)]} />
					<ParentPickList parents={pick.parents} byId={byId} cardIds={cardIds} data={data} />
				</ol>
			)}
			{pick && <div style={stale ? { opacity: 0.5 } : undefined}>
				<AceSkillRows rows={pick.skills} data={data} parentNames={new Map(pick.parents.map((p) => [p.candidateId, byId.get(p.candidateId)?.name ?? p.candidateId]))} />
				{pick.skills.some((r) => r.assumesPosition) && <p class="muted">* assumes the default position, so the sim cannot judge it fully</p>}
			</div>}
		</section>
	);
}
