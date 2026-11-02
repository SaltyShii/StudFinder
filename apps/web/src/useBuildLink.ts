import { useEffect, useState } from 'preact/hooks';
import { buildOptimizerLink, encodeBuildCode, type BuildCode } from './buildCode';

/** The link that opens `code` in uma.moe's Build optimizer, once it is encoded; a link for an earlier code is never shown. */
export function useBuildLink(code: BuildCode | null): string | undefined {
	const [link, setLink] = useState<{ code: BuildCode; href: string }>();
	useEffect(() => {
		if (!code) return;
		let live = true;
		encodeBuildCode(code).then((encoded) => { if (live) setLink({ code, href: buildOptimizerLink(encoded) }); });
		return () => { live = false; };
	}, [code]);
	return link && link.code === code ? link.href : undefined;
}
