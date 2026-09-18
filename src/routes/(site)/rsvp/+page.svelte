<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Button,
		CheckboxGroup,
		Field,
		Heading,
		RadioGroup,
		Section,
		TextInput,
		Toast
	} from '$lib/ui';

	let { data, form } = $props();

	const rsvp = $derived(data.content.rsvp);
	const thanks = $derived(data.content.thanks);
	// A failed post shows what the guest typed, not the saved answer.
	const values = $derived(form?.values ?? data.values);
	// Errors that belong to one field show next to it instead of above the form.
	const fieldErrors = ['nameRequired', 'attendingRequired', 'companionNameRequired'];
	const banner = $derived(
		form?.error && !fieldErrors.includes(form.error) ? rsvp[form.error] : undefined
	);
	const sent = $derived(form?.sent);

	let pending = $state(false);
</script>

<svelte:head>
	<title>{rsvp.title}</title>
</svelte:head>

<main>
	<Section variant="light">
		<div class="mx-auto flex max-w-md flex-col gap-10">
			{#if sent}
				<!-- The end of the road: the answer is with the hosts and there is nowhere else to go. -->
				<div class="flex flex-col items-center gap-4 text-center">
					<p class="eyebrow text-accent">{thanks.eyebrow}</p>
					<Heading level={1} script>
						{sent === 'yes' ? thanks.titleYes : thanks.titleNo}
					</Heading>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4 text-center">
					<p class="eyebrow text-accent">{rsvp.eyebrow}</p>
					<div id="rsvp-title">
						<Heading level={1} script>{rsvp.title}</Heading>
					</div>
					<p class="text-lg">{rsvp.deadline}</p>
				</div>

				{#if !data.open}
					<Toast kind="error" text={rsvp.closed} />
				{:else}
					<form
						method="POST"
						class="rsvp flex flex-col gap-8"
						aria-labelledby="rsvp-title"
						use:enhance={() => {
							pending = true;
							return async ({ update }) => {
								await update({ reset: false });
								pending = false;
							};
						}}
					>
						{#if banner}
							<Toast kind="error" text={banner} />
						{/if}

						<Field
							label={rsvp.nameLabel}
							error={form?.error === 'nameRequired' ? rsvp.nameRequired : undefined}
							required
						>
							{#snippet children(id)}
								<TextInput
									{id}
									name="name"
									value={values.name}
									maxlength={120}
									autocomplete="name"
									required
									aria-invalid={form?.error === 'nameRequired' ? 'true' : undefined}
								/>
							{/snippet}
						</Field>

						<Field
							label={rsvp.attendingLabel}
							error={form?.error === 'attendingRequired' ? rsvp.attendingRequired : undefined}
							required
						>
							{#snippet children(id)}
								<RadioGroup
									name="attending"
									options={[
										{ id: 'yes', label: rsvp.attendingYes },
										{ id: 'no', label: rsvp.attendingNo }
									]}
									value={values.attending ?? undefined}
									aria-labelledby="{id}-label"
									required
								/>
							{/snippet}
						</Field>

						{#if data.plusOneAllowed}
							<!-- Hidden by CSS once the guest declines; the server drops the companion anyway. -->
							<div class="companion flex flex-col gap-6">
								<Field label={rsvp.companionLabel}>
									{#snippet children(id)}
										<CheckboxGroup
											name="companion"
											options={[{ id: 'yes', label: rsvp.companionOption }]}
											values={values.companion ? ['yes'] : []}
											aria-labelledby="{id}-label"
										/>
									{/snippet}
								</Field>

								<div class="companion-fields flex flex-col gap-6 border-l-2 border-accent/30 pl-5">
									<Field
										label={rsvp.companionFirstName}
										error={form?.error === 'companionNameRequired'
											? rsvp.companionNameRequired
											: undefined}
									>
										{#snippet children(id)}
											<TextInput
												{id}
												name="companionName"
												value={values.companionName}
												maxlength={120}
												autocomplete="off"
												aria-invalid={form?.error === 'companionNameRequired' ? 'true' : undefined}
											/>
										{/snippet}
									</Field>
								</div>
							</div>
						{/if}

						<Button variant="solid" type="submit" loading={pending}>
							{data.answered ? rsvp.save : rsvp.submit}
						</Button>
					</form>
				{/if}
			{/if}
		</div>
	</Section>
</main>

<style>
	/* Pure CSS, so declining hides the companion with or without JavaScript. */
	.rsvp:has(:global(input[name='attending'][value='no']:checked)) .companion,
	.companion:not(:has(:global(input[name='companion']:checked))) .companion-fields {
		display: none;
	}
</style>
