export function formatAge(generatedAt: string, now = Date.now()): string {
	const days = Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 86_400_000));
	return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}
