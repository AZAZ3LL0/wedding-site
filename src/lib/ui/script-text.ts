/**
 * Great Vibes draws the capital A as an enlarged lowercase a, so «Алина» reads as «алина». The
 * script font stack puts a real capital A (U+0041, from Parisienne) in front of Great Vibes, and
 * the Cyrillic А (U+0410) only reaches it once painted as the Latin letter of the same shape.
 * Only the painted text changes: ScriptText keeps the original for screen readers and search.
 */
export function displayScript(text: string): string {
	return text.replaceAll('\u0410', 'A');
}
