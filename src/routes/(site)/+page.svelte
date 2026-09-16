<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button, Field, Heading, RadioGroup, Section, TextInput, Toast } from '$lib/ui';
	import Envelope from './Envelope.svelte';

	let { data, form } = $props();

	const entry = $derived(data.content.entry);
	const typed = $derived(form ? `${form.firstName.trim()} ${form.lastName.trim()}` : '');
	const firstNameError = $derived(form?.missing.firstName ? entry.firstNameRequired : undefined);
	const lastNameError = $derived(form?.missing.lastName ? entry.lastNameRequired : undefined);

	type Action = 'register' | 'choose' | 'new';
	let pending = $state<Action | null>(null);

	// The envelope opens the site wherever a guest lands first: here before the name, or on /i.
	let covering = $state(false);
	let main: HTMLElement;

	const track =
		(action: Action): SubmitFunction =>
		({ submitter }) => {
			// The known-cards form has two buttons; the one pressed decides what is pending.
			pending = submitter?.getAttribute('formaction') === '?/new' ? 'new' : action;
			return async ({ update }) => {
				await update({ reset: false });
				pending = null;
			};
		};
</script>

<svelte:head>
	<title>{entry.title}</title>
	<link rel="preload" as="image" href="/images/envelope.webp" fetchpriority="high" />
	<link rel="preload" as="image" href="/images/envelope-seal.webp" fetchpriority="high" />
</svelte:head>

<Envelope
	envelope={data.content.envelope}
	oncover={(value) => (covering = value)}
	onopen={async () => {
		// Wait for `inert` to leave the DOM, otherwise the browser refuses the focus.
		await tick();
		main.focus({ preventScroll: true });
	}}
/>

<main
	class="grid min-h-dvh place-items-center outline-none"
	tabindex="-1"
	inert={covering}
	bind:this={main}
>
	<Section variant="light" class="w-full">
		<div class="mx-auto flex max-w-sm flex-col gap-10">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="eyebrow text-accent">{entry.eyebrow}</p>
				<div id="entry-title">
					<Heading level={1} script>{entry.title}</Heading>
				</div>
				<p class="text-lg">{entry.text}</p>
			</div>

			<form
				method="POST"
				action="?/register"
				class="flex flex-col gap-6"
				aria-labelledby="entry-title"
				use:enhance={track('register')}
			>
				{#if form?.status === 'failed'}
					<Toast kind="error" text={entry.failed} />
				{/if}
				<Field label={entry.firstNameLabel} error={firstNameError} required>
					{#snippet children(id)}
						<TextInput
							{id}
							name="firstName"
							value={form?.firstName ?? ''}
							maxlength={60}
							autocomplete="given-name"
							required
							aria-invalid={firstNameError ? 'true' : undefined}
							aria-describedby={firstNameError ? `${id}-error` : undefined}
						/>
					{/snippet}
				</Field>
				<Field label={entry.lastNameLabel} error={lastNameError} required>
					{#snippet children(id)}
						<TextInput
							{id}
							name="lastName"
							value={form?.lastName ?? ''}
							maxlength={60}
							autocomplete="family-name"
							required
							aria-invalid={lastNameError ? 'true' : undefined}
							aria-describedby={lastNameError ? `${id}-error` : undefined}
						/>
					{/snippet}
				</Field>
				<Button variant="solid" type="submit" loading={pending === 'register'}>
					{entry.submit}
				</Button>
			</form>

			{#if form?.status === 'known'}
				<form
					method="POST"
					action="?/choose"
					class="flex flex-col gap-6 border-t border-muted/30 pt-8"
					aria-labelledby="known-title"
					use:enhance={track('choose')}
				>
					<div id="known-title">
						<Heading level={2}>{entry.knownTitle}</Heading>
					</div>
					<input type="hidden" name="firstName" value={form.firstName} />
					<input type="hidden" name="lastName" value={form.lastName} />
					<Field label={entry.knownText} required>
						{#snippet children(id)}
							<RadioGroup
								name="guestId"
								options={form.cards.map((card) => ({
									id: card.guestId,
									label: card.hint ? `${typed}, ${card.hint}` : typed
								}))}
								aria-labelledby="{id}-label"
								required
							/>
						{/snippet}
					</Field>
					<Button variant="solid" type="submit" loading={pending === 'choose'}>
						{entry.submit}
					</Button>
					<Button
						variant="ghost"
						type="submit"
						formaction="?/new"
						formnovalidate
						loading={pending === 'new'}
					>
						{entry.knownNew}
					</Button>
				</form>
			{/if}
		</div>
	</Section>
</main>
