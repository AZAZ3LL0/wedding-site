// A job that can never succeed on retry. The worker fails it once instead of burning retries.
export class InvalidPayloadError extends Error {
	constructor(topic: string, issues: string[]) {
		super(`Invalid ${topic} payload: ${issues.join('; ')}`);
		this.name = 'InvalidPayloadError';
	}
}
