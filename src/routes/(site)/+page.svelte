<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, Field, Heading, RadioGroup, Section, TextInput, Toast } from '$lib/ui';

	let { data, form } = $props();

	const entry = $derived(data.content.entry);
	const unknown = $derived(data.content.unknown);
	const requesting = $derived(
		data.notListed ||
			form?.status === 'notFound' ||
			form?.status === 'unknownInvalid' ||
			form?.status === 'failed'
	);
	const error = $derived(
		form?.status === 'invalid'
			? entry.nameRequired
			: form?.status === 'notFound'
				? entry.notFound
				: undefined
	);

	type Action = 'find' | 'choose' | 'unknown';
	let pending = $state<Action | null>(null);

	const track =
		(action: Action): SubmitFunction =>
		() => {
			pending = action;
			return async ({ update }) => {
				await update({ reset: false });
				pending = null;
			};
		};
</script>

<svelte:head>
	<title>{entry.title}</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center">
	<Section variant="light" class="w-full">
		<div class="mx-auto flex max-w-sm flex-col gap-10">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="eyebrow text-olive">{entry.eyebrow}</p>
				<div id="entry-title">
					<Heading level={1} script>{entry.title}</Heading>
				</div>
			</div>

			<form
				method="POST"
				action="?/find"
				class="flex flex-col gap-6"
				aria-labelledby="entry-title"
				use:enhance={track('find')}
			>
				<Field label={entry.nameLabel} {error} required>
					{#snippet children(id)}
						<TextInput
							{id}
							name="name"
							value={form?.name ?? ''}
							placeholder={entry.namePlaceholder}
							maxlength={100}
							autocomplete="name"
							required
							aria-invalid={error ? 'true' : undefined}
							aria-describedby={error ? `${id}-error` : undefined}
						/>
					{/snippet}
				</Field>
				<Button variant="solid" type="submit" loading={pending === 'find'}>{entry.submit}</Button>
			</form>

			{#if form?.status === 'choose'}
				<form
					method="POST"
					action="?/choose"
					class="flex flex-col gap-6 border-t border-muted/30 pt-8"
					aria-labelledby="choose-title"
					use:enhance={track('choose')}
				>
					<div id="choose-title">
						<Heading level={2}>{entry.chooseTitle}</Heading>
					</div>
					<input type="hidden" name="name" value={form.name} />
					<Field label={entry.chooseText} required>
						{#snippet children(id)}
							<RadioGroup
								name="guestId"
								options={form.candidates.map((c) => ({ id: c.guestId, label: c.hint }))}
								aria-labelledby="{id}-label"
								required
							/>
						{/snippet}
					</Field>
					<Button variant="solid" type="submit" loading={pending === 'choose'}>
						{entry.submit}
					</Button>
				</form>
			{/if}

			{#if form?.status === 'sent'}
				<Toast kind="ok" text={unknown.sent} />
			{:else if requesting}
				<form
					method="POST"
					action="?/unknown"
					class="flex flex-col gap-6 border-t border-muted/30 pt-8"
					aria-labelledby="unknown-title"
					use:enhance={track('unknown')}
				>
					<div id="unknown-title">
						<Heading level={2}>{unknown.title}</Heading>
					</div>
					<p>{unknown.text}</p>
					{#if form?.status === 'failed'}
						<Toast kind="error" text={unknown.failed} />
					{/if}
					<Field
						label={unknown.nameLabel}
						error={form?.status === 'unknownInvalid' ? entry.nameRequired : undefined}
						required
					>
						{#snippet children(id)}
							<TextInput
								{id}
								name="name"
								value={form?.name ?? ''}
								maxlength={100}
								autocomplete="name"
								required
								aria-invalid={form?.status === 'unknownInvalid' ? 'true' : undefined}
								aria-describedby={form?.status === 'unknownInvalid' ? `${id}-error` : undefined}
							/>
						{/snippet}
					</Field>
					<Field label={unknown.contactLabel}>
						{#snippet children(id)}
							<TextInput
								{id}
								name="contact"
								value={form?.contact ?? ''}
								placeholder={unknown.contactPlaceholder}
								maxlength={100}
							/>
						{/snippet}
					</Field>
					<Button variant="ghost" type="submit" loading={pending === 'unknown'}>
						{unknown.submit}
					</Button>
				</form>
			{:else}
				<a
					href="{resolve('/')}?unknown"
					class="self-center text-olive-deep underline decoration-olive/40 underline-offset-4 hover:decoration-olive"
				>
					{entry.notListed}
				</a>
			{/if}
		</div>
	</Section>
</main>
