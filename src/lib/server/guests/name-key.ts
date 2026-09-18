/**
 * Splits what a guest typed into one field into the first and last name the table keeps.
 * The first word is the name, everything after it is the surname; a single word leaves it empty.
 */
export function splitFullName(raw: string): { firstName: string; lastName: string } {
	const [firstName = '', ...rest] = raw.trim().replace(/\s+/gu, ' ').split(' ');
	return { firstName, lastName: rest.join(' ') };
}

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
