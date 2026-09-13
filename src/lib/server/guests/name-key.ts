// Normalized lookup key for a guest name, see tech.md §6.
export function nameKey(raw: string): string {
	return (
		raw
			.toLowerCase()
			.replaceAll('ё', 'е')
			// Tabs and newlines count as spaces, otherwise pasted names would glue tokens together.
			.replace(/\s+/gu, ' ')
			.replace(/[^\p{L} ]/gu, '')
			.split(' ')
			.filter(Boolean)
			// Sorted tokens make "Иван Петров" and "Петров Иван" the same key.
			.sort()
			.join(' ')
	);
}
