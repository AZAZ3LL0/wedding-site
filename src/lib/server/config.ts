// The only module that reads process.env. Everything else receives typed config from here.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// The fake client needs some chat id to address; nothing is ever delivered to it.
const FAKE_ADMIN_CHAT_ID = 1;

const optional = z.string().optional();

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
		PUBLIC_SITE_URL: z.url().default('http://localhost:5173'),
		TELEGRAM_BOT_TOKEN: optional,
		TELEGRAM_BOT_USERNAME: optional,
		TELEGRAM_WEBHOOK_SECRET: optional,
		TELEGRAM_ADMIN_CHAT_ID: z.coerce.number().int().optional(),
		ADMIN_PASSWORD: z.string().min(12).optional(),
		SESSION_SECRET: z.string().min(32).optional(),
		USE_FAKE_TELEGRAM: z.enum(['true', 'false']).transform((v) => v === 'true')
	})
	.superRefine((env, ctx) => {
		const require = (key: keyof typeof env, reason: string) => {
			if (env[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: reason });
		};
		if (env.NODE_ENV === 'production') {
			require('ADMIN_PASSWORD', 'required in production');
			require('SESSION_SECRET', 'required in production');
		}
		if (!env.USE_FAKE_TELEGRAM) {
			for (const key of [
				'TELEGRAM_BOT_TOKEN',
				'TELEGRAM_BOT_USERNAME',
				'TELEGRAM_WEBHOOK_SECRET',
				'TELEGRAM_ADMIN_CHAT_ID'
			] as const) {
				require(key, 'required when USE_FAKE_TELEGRAM=false');
			}
		}
	});

export type Config = ReturnType<typeof parseConfig>;

export function parseConfig(raw: Record<string, string | undefined>) {
	// `KEY=` lines in .env mean "not set", not "set to an empty string".
	const env = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
	const result = envSchema.safeParse(env);
	if (!result.success) {
		// Paths and messages only: zod issues can echo the rejected values, which may be secrets.
		const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
		throw new Error(`Invalid environment:\n${issues.join('\n')}`);
	}
	const e = result.data;
	return {
		isProduction: e.NODE_ENV === 'production',
		databaseUrl: e.DATABASE_URL,
		publicSiteUrl: e.PUBLIC_SITE_URL,
		adminPassword: e.ADMIN_PASSWORD ?? null,
		// A random secret per start outside production: sessions reset on restart, nothing to leak.
		sessionSecret: e.SESSION_SECRET ?? randomBytes(32).toString('hex'),
		telegram: {
			useFake: e.USE_FAKE_TELEGRAM,
			botToken: e.TELEGRAM_BOT_TOKEN ?? null,
			botUsername: e.TELEGRAM_BOT_USERNAME ?? null,
			webhookSecret: e.TELEGRAM_WEBHOOK_SECRET ?? null,
			adminChatId: e.TELEGRAM_ADMIN_CHAT_ID ?? FAKE_ADMIN_CHAT_ID
		}
	};
}

let cached: Config | undefined;

export function getConfig(): Config {
	if (!cached) {
		if (process.env.NODE_ENV !== 'production' && existsSync('.env')) {
			// Existing variables win, so CI and systemd values are never overridden by a stray file.
			process.loadEnvFile('.env');
		}
		cached = parseConfig(process.env);
	}
	return cached;
}
