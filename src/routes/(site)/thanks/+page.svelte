<script lang="ts">
	import { resolve } from '$app/paths';
	import { Divider, Heading, Section } from '$lib/ui';

	let { data } = $props();

	const thanks = $derived(data.content.thanks);
	const title = $derived(data.attending === 'yes' ? thanks.titleYes : thanks.titleNo);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#snippet summary(rows: { label: string; value: string }[])}
	<dl class="flex flex-col gap-4">
		{#each rows as row (row.label)}
			<div class="flex flex-col gap-1 border-b border-muted/20 pb-3">
				<dt class="text-sm font-medium text-muted">{row.label}</dt>
				<dd class="text-lg whitespace-pre-line">{row.value}</dd>
			</div>
		{/each}
	</dl>
{/snippet}

<main>
	<Section variant="light">
		<div class="mx-auto flex max-w-md flex-col gap-10">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="eyebrow text-accent">{thanks.eyebrow}</p>
				<Heading level={1} script>{title}</Heading>
			</div>

			<section class="flex flex-col gap-6" aria-labelledby="summary-title" data-summary>
				<div id="summary-title">
					<Heading level={3}>{thanks.summaryTitle}</Heading>
				</div>
				{@render summary(data.rows)}
			</section>

			{#if data.companion}
				<section class="flex flex-col gap-6" aria-labelledby="companion-title" data-companion>
					<div id="companion-title" class="flex flex-col gap-1">
						<Heading level={3}>{thanks.companionTitle}</Heading>
						<p class="text-lg">{data.companion.name}</p>
					</div>
					{@render summary(data.companion.rows)}
				</section>
			{/if}

			{#if data.botLink}
				<section class="flex flex-col gap-4" aria-labelledby="bot-title" data-bot-link>
					<div id="bot-title">
						<Heading level={3}>{thanks.bot.title}</Heading>
					</div>
					<p class="text-muted">{thanks.bot.text}</p>
					<!-- A link, not a Button: it leaves the site for Telegram. -->
					<a
						href={data.botLink}
						rel="noreferrer"
						class="inline-flex min-h-11 items-center justify-center rounded-token border border-accent px-8 py-3 font-medium text-accent-deep transition-colors duration-(--dur-fast) ease-out hover:bg-accent hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{thanks.bot.cta}
					</a>
				</section>
			{/if}

			<div class="flex flex-col items-center gap-6 text-accent">
				<Divider orientation="vertical" />
				{#if data.canEdit}
					<!-- Links, not Buttons: both navigate instead of submitting anything. -->
					<a
						href={resolve('/rsvp')}
						class="inline-flex min-h-11 items-center justify-center rounded-token bg-accent px-8 py-3 font-medium text-ivory transition-colors duration-(--dur-fast) ease-out hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{thanks.edit}
					</a>
				{/if}
				<a
					href={resolve('/i')}
					class="text-accent-deep underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
				>
					{thanks.back}
				</a>
			</div>
		</div>
	</Section>
</main>
