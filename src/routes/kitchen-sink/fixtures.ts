// Sample data for the dev-only showcase. Site copy lives in $lib/content, not here.
export const colorTokens = ['--c-ink', '--c-paper', '--c-forest', '--c-muted'] as const;

export const fontTokens = [
	{ token: '--font-display', className: 'font-display text-4xl' },
	{ token: '--font-script', className: 'font-script text-5xl' },
	{ token: '--font-body', className: 'font-body text-base' }
] as const;

export const specimen = 'Съешь же ещё этих мягких французских булок. Wedding 28.08';
