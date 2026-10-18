import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { GameData } from '../../../packages/lineage/src/gameData';
import type { SkillDetail } from '../../../packages/scoring/src/recommend';

/** Portrait that degrades to a neutral placeholder when the card image is missing. */
function Portrait({ cardId }: { cardId: number | undefined }) {
	const [failed, setFailed] = useState(false);
	if (cardId == null || failed) return <div class="portrait placeholder" data-testid="portrait-placeholder" />;
	return <img class="portrait" alt="" src={`${import.meta.env.BASE_URL}img/cards/${cardId}.png`} onError={() => setFailed(true)} />;
}

export function SkillDetails({ detail, data, note }: { detail: SkillDetail[]; data: GameData; note?: string }) {
	if (!detail.length) return null;
	return (
		<details>
			<summary>Skills</summary>
			{note && <p class="muted">{note}</p>}
			<ul>{detail.map((d) => (
				<li>{data.skills.get(Number(d.skillId))?.name ?? d.skillId}: {d.proc.toFixed(0)}% proc, {d.lengths.median.toFixed(2)} median lengths, value {d.value.toFixed(2)}{d.assumesPosition && ' (assumes default position)'}</li>
			))}</ul>
		</details>
	);
}

interface Props {
	testId: string;
	cardId: number | undefined;
	name: string;
	headline: ComponentChildren;
	chips?: string[];
	meta?: string;
	caveats?: string[];
	best?: boolean;
	children?: ComponentChildren;
}

export function UmaCard({ testId, cardId, name, headline, chips = [], meta, caveats = [], best, children }: Props) {
	return (
		<li class={best ? 'card best' : 'card'} data-testid={testId} data-best={best || undefined}>
			<Portrait cardId={cardId} />
			<div class="card-body">
				<strong>{name}</strong>
				<div class="headline">{headline}</div>
				{chips.length > 0 && <div class="chips">{chips.map((c) => <span class="chip">{c}</span>)}</div>}
				{meta && <div class="muted">{meta}</div>}
				{caveats.map((c) => <div class="caveat">{c}</div>)}
				{children}
			</div>
		</li>
	);
}
