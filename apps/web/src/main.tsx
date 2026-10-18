import { render } from 'preact';
import { useState } from 'preact/hooks';
import { loadGameData } from '../../../packages/lineage/src/gameData';
import type { ImportResult } from '../../../packages/lineage/src/types';
import { clearRoster, importRoster, loadRoster, saveRoster } from './roster';

function App() {
	const [roster, setRoster] = useState<ImportResult | null>(() => loadRoster(localStorage));
	const [error, setError] = useState('');

	async function onFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const next = importRoster(await file.text(), await loadGameData());
			saveRoster(localStorage, next);
			setRoster(next);
			setError('');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err)); // previous Roster stays
		}
	}

	return (
		<main>
			<h1>Stud Finder</h1>
			<p>Your export is read in this browser only and never sent anywhere.</p>
			<input type="file" accept=".json,application/json" onChange={onFile} />
			{error && <p role="alert">{error}</p>}
			{roster && (
				<section>
					<h2>Roster</h2>
					<p>{roster.veterans.length} veterans, {roster.borrowed.length} borrowed</p>
					<button onClick={() => { clearRoster(localStorage); setRoster(null); }}>Clear data</button>
				</section>
			)}
		</main>
	);
}

render(<App />, document.getElementById('app')!);
