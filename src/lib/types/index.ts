import { z } from 'zod';

export type Audience = 'family' | 'friends' | 'colleagues';
export type AttendStatus = 'yes' | 'no';
export type ReminderStage = 'd30' | 'd7';
export type PlusOnePolicy = 'none' | 'allowed';

// What the server sends to the browser. Never contains botToken, telegramChatId or note.
export type GuestPublic = {
	id: string;
	displayName: string;
	firstName: string;
	audience: Audience;
	invitedToRegistry: boolean;
	plusOnePolicy: PlusOnePolicy;
	isPlusOne: boolean;
	partyMembers: { id: string; displayName: string; isPlusOne: boolean }[];
	rsvp: RsvpPublic | null;
};

export type RsvpPublic = {
	attending: AttendStatus;
	attendingRegistry: boolean;
	mainCourses: string[];
	drinks: string[];
	allergies: string | null;
	needsTransfer: boolean;
	songRequest: string | null;
	comment: string | null;
	updatedAt: string;
};

// The single schema for the web form and the bot. There is no other way to write an RSVP.
export const rsvpPayloadSchema = z.object({
	attending: z.enum(['yes', 'no']),
	attendingRegistry: z.boolean().default(false),
	mainCourses: z.array(z.string()).default([]),
	drinks: z.array(z.string()).default([]),
	allergies: z.string().max(300).nullable().default(null),
	needsTransfer: z.boolean().default(false),
	songRequest: z.string().max(200).nullable().default(null),
	comment: z.string().max(1000).nullable().default(null),
	telegramUsername: z.string().max(64).nullable().default(null),
	companion: z
		.object({
			firstName: z.string().min(1).max(60),
			lastName: z.string().max(60).default(''),
			mainCourses: z.array(z.string()).default([]),
			drinks: z.array(z.string()).default([])
		})
		.nullable()
		.default(null)
});
export type RsvpPayload = z.infer<typeof rsvpPayloadSchema>;

export type MatchResult =
	| { kind: 'single'; guestId: string }
	| { kind: 'ambiguous'; candidates: { guestId: string; hint: string }[] }
	| { kind: 'none' };

// Job payloads, see tech.md §5. Handlers validate their input with these schemas.
export const demoPingJobSchema = z.object({ pingId: z.uuid() });
export type DemoPingJob = z.infer<typeof demoPingJobSchema>;
