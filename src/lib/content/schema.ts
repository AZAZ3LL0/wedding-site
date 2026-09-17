import { z } from 'zod';

// Placeholders stay valid for the schema; content.test.ts keeps them out of wedding.ts.
const TODO = z.literal('TODO');

// Refine instead of trim(): parsing never rewrites the author's strings.
const text = z.string().refine((value) => value.trim() !== '', 'expected non-empty text');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
const displayTime = z.union([TODO, hhmm]);

// The regex alone accepts 2026-02-30; a round trip through Date catches impossible days.
const calendarDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
	.refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
	}, 'not a calendar date');

const utcOffset = z.string().regex(/^[+-](0\d|1[0-4]):[0-5]\d$/, 'expected ±HH:MM');

const httpsUrl = z.url({ protocol: /^https$/ });
const mapUrl = z.union([TODO, httpsUrl]);

// Root-relative paths are served from static/; protocol-relative `//host` is not a root path.
const rootPath = z.string().regex(/^\/(?!\/)\S*$/, 'expected a path from the site root');

const image = z.strictObject({ src: z.union([rootPath, httpsUrl]), alt: text });

const pluralForms = z.tuple([text, text, text]);

const slug = z.string().regex(/^[a-z0-9-]+$/, 'expected a slug');

const menuOptions = z
	.array(z.strictObject({ id: slug, label: text }))
	.superRefine((options, ctx) => {
		const seen = new Set<string>();
		options.forEach((option, index) => {
			if (seen.has(option.id)) {
				ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'duplicate id' });
			}
			seen.add(option.id);
		});
	});

const registry = z.strictObject({
	title: text,
	address: text,
	gatherTime: displayTime,
	ceremonyTime: displayTime,
	mapUrl,
	photos: z.array(image).default([])
});

const contact = z
	.strictObject({
		role: text,
		name: text,
		phone: z.union([TODO, z.string().regex(/^\+?[\d ()-]{6,20}$/, 'expected a phone')]).nullable(),
		telegram: z
			.union([TODO, z.string().regex(/^[A-Za-z0-9_]{5,32}$/, 'expected a username without @')])
			.nullable()
	})
	.refine((c) => c.phone !== null || c.telegram !== null, {
		message: 'phone or telegram is required',
		path: ['phone']
	});

const audienceCopy = z.strictObject({
	label: text,
	greeting: text,
	address: z.enum(['ты', 'вы']),
	showRegistry: z.boolean()
});

export const contentSchema = z.strictObject({
	couple: z.strictObject({ bride: text, groom: text }),
	hosts: text,
	event: z
		.strictObject({
			title: text,
			date: calendarDate,
			time: hhmm,
			utcOffset,
			rsvpDeadline: calendarDate,
			city: text
		})
		.refine((e) => e.rsvpDeadline <= e.date, {
			message: 'rsvpDeadline is after the event date',
			path: ['rsvpDeadline']
		}),
	envelope: z.strictObject({ eyebrow: text, title: text, monogram: text, open: text }),
	cover: z.strictObject({ eyebrow: text, title: text, text, photo: image }),
	invitation: z.strictObject({
		eyebrow: text,
		title: text,
		dateLine: text,
		timeLine: text,
		text
	}),
	registry: registry.nullable().default(null),
	venue: z.strictObject({
		title: text,
		address: text,
		startTime: displayTime,
		endTime: displayTime,
		mapUrl,
		photos: z.array(image).default([])
	}),
	timeline: z
		.array(
			z.strictObject({
				time: displayTime,
				title: text,
				caption: text,
				icon: z.enum(['pin', 'rings', 'dish'])
			})
		)
		.default([]),
	dressCode: z.strictObject({
		text,
		palette: z
			.array(
				z.strictObject({
					hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb'),
					name: text
				})
			)
			.default([])
	}),
	gifts: text.nullable().default(null),
	transfer: z.strictObject({ route: text, time: displayTime }).nullable().default(null),
	contacts: z.array(contact).default([]),
	menu: z.strictObject({
		multiSelect: z.boolean().default(false),
		courses: menuOptions,
		drinks: menuOptions
	}),
	music: z.strictObject({ enabled: z.boolean(), src: rootPath }),
	sections: z.strictObject({
		location: z.strictObject({
			eyebrow: text,
			title: text,
			venueStart: text,
			registryGather: text,
			registryCeremony: text
		}),
		dressCode: z.strictObject({ eyebrow: text, title: text }),
		farewell: z.strictObject({ eyebrow: text })
	}),
	entry: z.strictObject({
		eyebrow: text,
		title: text,
		text,
		firstNameLabel: text,
		lastNameLabel: text,
		submit: text,
		firstNameRequired: text,
		lastNameRequired: text,
		knownTitle: text,
		knownText: text,
		knownNew: text,
		failed: text
	}),
	rsvp: z.strictObject({
		cta: text,
		ctaAnswered: text,
		eyebrow: text,
		title: text,
		deadline: text,
		attendingLabel: text,
		attendingYes: text,
		attendingNo: text,
		registryLabel: text,
		registryOption: text,
		coursesLabel: text,
		drinksLabel: text,
		allergiesLabel: text,
		allergiesPlaceholder: text,
		transferLabel: text,
		transferOption: text,
		companionLabel: text,
		companionOption: text,
		companionFirstName: text,
		companionLastName: text,
		companionCourses: text,
		companionDrinks: text,
		commentLabel: text,
		commentPlaceholder: text,
		telegramLabel: text,
		telegramPlaceholder: text,
		telegramHint: text,
		submit: text,
		save: text,
		attendingRequired: text,
		companionNameRequired: text,
		companionNotAttending: text,
		unknownOption: text,
		invalid: text,
		failed: text,
		closed: text
	}),
	thanks: z.strictObject({
		eyebrow: text,
		titleYes: text,
		titleNo: text,
		summaryTitle: text,
		companionTitle: text,
		empty: text,
		edit: text,
		back: text,
		// Local stub pending a tech.md bump: section 7 does not spell this block out yet.
		bot: z.strictObject({ title: text, text, cta: text })
	}),
	ui: z.strictObject({
		countdown: z.strictObject({
			days: pluralForms,
			hours: pluralForms,
			minutes: pluralForms,
			seconds: pluralForms
		}),
		audio: z.strictObject({ play: text, pause: text }),
		map: z.strictObject({ open: text }),
		// Local stub pending a tech.md bump: the arch prints the month in words, section 7 has no list.
		months: z.tuple([text, text, text, text, text, text, text, text, text, text, text, text])
	}),
	byAudience: z.strictObject({
		family: audienceCopy,
		friends: audienceCopy,
		colleagues: audienceCopy
	})
});

export type Content = z.input<typeof contentSchema>;
export type ContentData = z.output<typeof contentSchema>;

export function parseContent(raw: unknown): ContentData {
	const result = contentSchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
		throw new Error(`Invalid content in src/lib/content/wedding.ts:\n${issues.join('\n')}`);
	}
	return result.data;
}
