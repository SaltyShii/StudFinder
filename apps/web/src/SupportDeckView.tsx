import type { SupportDeck } from '../../../packages/scoring/src/recommend';

/** The Support deck an Ace hero was ranked with: its own cards and the Borrowed support card to run, with the notes on why it is not the full 5 + 1. */
export function SupportDeckView({ deck }: { deck: SupportDeck }) {
	return <div class="support-deck" data-testid="support-deck">
		<h4>Support deck</h4>
		<ul class="deck-cards">
			{deck.own.map((p) => <li data-testid="deck-own">{p.card.name} ({p.card.type})</li>)}
			{Array.from({ length: deck.friendFillers ?? 0 }, () => <li data-testid="deck-filler">Friend (no hints)</li>)}
		</ul>
		{deck.borrowed && <p class="deck-borrowed">Borrowed: <span data-testid="deck-borrowed">{deck.borrowed.card.name} ({deck.borrowed.card.type})</span></p>}
		{deck.notes.map((n) => <p class="muted" data-testid="deck-note">{n}</p>)}
	</div>;
}
