<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { Button, Field, Heading, RadioGroup, Section, TextInput } from '$lib/ui';

	let { data, form } = $props();

	const entry = $derived(data.content.entry);
	const error = $derived(
		form?.status === 'invalid'
			? entry.nameRequired
			: form?.status === 'notFound'
				? entry.notFound
				: undefined
	);

	let pending = $state<'find' | 'choose' | null>(null);

	const track =
		(action: 'find' | 'choose'): SubmitFunction =>
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
				<Heading level={1} script>{entry.title}</Heading>
			</div>

			<form method="POST" action="?/find" class="flex flex-col gap-6" use:enhance={track('find')}>
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
		</div>
	</Section>
</main>
