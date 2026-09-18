// The only module that reads process.env. Everything else receives typed config from here.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
		PUBLIC_SITE_URL: z.url().default('http://localhost:5173'),
		ADMIN_PASSWORD: z.string().min(12).optional(),
		SESSION_SECRET: z.string().min(32).optional(),
		// The gallery of primitives is a development page; production leaves this unset.
		SHOW_KITCHEN_SINK: z
			.enum(['true', 'false'])
			.default('false')
			.transform((v) => v === 'true')
	})
	.superRefine((env, ctx) => {
		const require = (key: keyof typeof env, reason: string) => {
			if (env[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: reason });
		};
		if (env.NODE_ENV === 'production') {
			require('ADMIN_PASSWORD', 'required in production');
			require('SESSION_SECRET', 'required in production');
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
		showKitchenSink: e.SHOW_KITCHEN_SINK
	};
}

let cached: Config | undefined;

export function getConfig(): Config {
	if (!cached) {
		if (existsSync('.env')) {
			// Existing variables win, so CI and systemd values are never overridden by a stray file.
			process.loadEnvFile('.env');
		}
		cached = parseConfig(process.env);
	}
	return cached;
}
