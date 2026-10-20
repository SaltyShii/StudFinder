import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';

interface Props {
	title: string;
	onClose: () => void;
	children: ComponentChildren;
}

/** Centered dialog over a dimmed backdrop; closes on X, Esc or a backdrop click. */
export function Modal({ title, onClose, children }: Props) {
	const ref = useRef<HTMLDivElement>(null);
	const titleId = useId();
	// A ref keeps the latest onClose without re-subscribing (and re-focusing) on every render.
	const close = useRef(onClose);
	close.current = onClose;
	useEffect(() => {
		const before = document.activeElement as HTMLElement | null;
		(ref.current!.querySelector<HTMLElement>('input') ?? ref.current!).focus();
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
		document.addEventListener('keydown', onKey);
		return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
	}, []);
	return (
		<div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div class="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
				<header><h2 id={titleId}>{title}</h2><button type="button" class="modal-close" aria-label="Close" onClick={onClose}>×</button></header>
				<div class="modal-body">{children}</div>
			</div>
		</div>
	);
}
