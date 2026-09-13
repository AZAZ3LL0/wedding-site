// Pure selection logic for CheckboxGroup: the component only renders what this returns.
export function toggleValue(values: string[], id: string, max?: number): string[] {
	if (values.includes(id)) return values.filter((v) => v !== id);
	if (max !== undefined && values.length >= max) return values;
	return [...values, id];
}

export function isAtLimit(values: string[], id: string, max?: number): boolean {
	return max !== undefined && values.length >= max && !values.includes(id);
}
