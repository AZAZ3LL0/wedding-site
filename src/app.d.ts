// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { GuestPublic } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Set by hooks.server.ts from the session cookie, null for a visitor without one.
			guest: GuestPublic | null;
			// Set by hooks.server.ts from the signed admin cookie, see lib/server/admin/auth.ts.
			admin: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
