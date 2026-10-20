import { versionName, type GameData } from '../../../packages/lineage/src/gameData';
import { gradeLabel, STYLE_LABEL } from '../../../packages/scoring/src/ace';
import type { AcePick, OwnedVersion } from '../../../packages/scoring/src/recommend';
import { UmaCard } from './UmaCard';

interface Props {
	pick: AcePick | null | undefined;
	data: GameData;
	ownedVersions: OwnedVersion[];
	/** Trained id to card id, for the parents' portraits. */
	cardIds: Map<string, number>;
	stale: boolean;
}

function nameOf(data: GameData, id: number) {
	const c = data.cards.get(id);
	return c ? versionName(c) : String(id);
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
					{pick.parents.map((p) => <UmaCard testId="ace-parent" cardId={cardIds.get(p.candidateId)} name={byId.get(p.candidateId)?.name ?? p.candidateId} headline={p.score.toFixed(2)} meta={p.reason}>
						<div class="cards">{byId.get(p.candidateId)?.horses.slice(1).map((g) => <img class="portrait" data-testid="ace-grandparent" alt={g.cardId == null ? "" : nameOf(data, g.cardId)} src={`${import.meta.env.BASE_URL}img/cards/${g.cardId}.png`} />)}</div>
					</UmaCard>)}
				</ol>
			)}
		</section>
	);
}
