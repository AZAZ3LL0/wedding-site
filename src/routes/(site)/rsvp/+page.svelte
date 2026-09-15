<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Button,
		CheckboxGroup,
		Field,
		Heading,
		RadioGroup,
		Section,
		TextArea,
		TextInput,
		Toast
	} from '$lib/ui';

	let { data, form } = $props();

	const rsvp = $derived(data.content.rsvp);
	const menu = $derived(data.content.menu);
	// A failed post shows what the guest typed, not the saved answer.
	const values = $derived(form?.values ?? data.values);
	// Errors that belong to one field show next to it instead of above the form.
	const banner = $derived(
		form?.error && form.error !== 'attendingRequired' && form.error !== 'companionNameRequired'
			? rsvp[form.error]
			: undefined
	);

	let pending = $state(false);
</script>

<svelte:head>
	<title>{rsvp.title}</title>
</svelte:head>

<main>
	<Section variant="light">
		<div class="mx-auto flex max-w-md flex-col gap-10">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="eyebrow text-olive">{rsvp.eyebrow}</p>
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

					<!-- Hidden by CSS once the guest declines; the server clears these fields anyway. -->
					<div class="details flex flex-col gap-8">
						{#if data.content.registry}
							<Field label={rsvp.registryLabel}>
								{#snippet children(id)}
									<CheckboxGroup
										name="attendingRegistry"
										options={[{ id: 'yes', label: rsvp.registryOption }]}
										values={values.attendingRegistry ? ['yes'] : []}
										aria-labelledby="{id}-label"
									/>
								{/snippet}
							</Field>
						{/if}

						<Field label={rsvp.coursesLabel}>
							{#snippet children(id)}
								{#if menu.multiSelect}
									<CheckboxGroup
										name="mainCourses"
										options={menu.courses}
										values={values.mainCourses}
										aria-labelledby="{id}-label"
									/>
								{:else}
									<RadioGroup
										name="mainCourses"
										options={menu.courses}
										value={values.mainCourses[0]}
										aria-labelledby="{id}-label"
									/>
								{/if}
							{/snippet}
						</Field>

						<Field label={rsvp.drinksLabel}>
							{#snippet children(id)}
								<CheckboxGroup
									name="drinks"
									options={menu.drinks}
									values={values.drinks}
									aria-labelledby="{id}-label"
								/>
							{/snippet}
						</Field>

						<Field label={rsvp.allergiesLabel}>
							{#snippet children(id)}
								<TextInput
									{id}
									name="allergies"
									value={values.allergies}
									placeholder={rsvp.allergiesPlaceholder}
									maxlength={300}
								/>
							{/snippet}
						</Field>

						{#if data.content.transfer}
							<Field label={rsvp.transferLabel}>
								{#snippet children(id)}
									<CheckboxGroup
										name="needsTransfer"
										options={[{ id: 'yes', label: rsvp.transferOption }]}
										values={values.needsTransfer ? ['yes'] : []}
										aria-labelledby="{id}-label"
									/>
								{/snippet}
							</Field>
						{/if}

						{#if data.plusOneAllowed}
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

								<div class="companion-fields flex flex-col gap-6 border-l-2 border-olive/30 pl-5">
									<Field
										label={rsvp.companionFirstName}
										error={form?.error === 'companionNameRequired'
											? rsvp.companionNameRequired
											: undefined}
									>
										{#snippet children(id)}
											<TextInput
												{id}
												name="companionFirstName"
												value={values.companionFirstName}
												maxlength={60}
												autocomplete="off"
												aria-invalid={form?.error === 'companionNameRequired' ? 'true' : undefined}
												aria-describedby={form?.error === 'companionNameRequired'
													? `${id}-error`
													: undefined}
											/>
										{/snippet}
									</Field>
									<Field label={rsvp.companionLastName}>
										{#snippet children(id)}
											<TextInput
												{id}
												name="companionLastName"
												value={values.companionLastName}
												maxlength={60}
												autocomplete="off"
											/>
										{/snippet}
									</Field>
									<Field label={rsvp.companionCourses}>
										{#snippet children(id)}
											{#if menu.multiSelect}
												<CheckboxGroup
													name="companionCourses"
													options={menu.courses}
													values={values.companionCourses}
													aria-labelledby="{id}-label"
												/>
											{:else}
												<RadioGroup
													name="companionCourses"
													options={menu.courses}
													value={values.companionCourses[0]}
													aria-labelledby="{id}-label"
												/>
											{/if}
										{/snippet}
									</Field>
									<Field label={rsvp.companionDrinks}>
										{#snippet children(id)}
											<CheckboxGroup
												name="companionDrinks"
												options={menu.drinks}
												values={values.companionDrinks}
												aria-labelledby="{id}-label"
											/>
										{/snippet}
									</Field>
								</div>
							</div>
						{/if}
					</div>

					<Field label={rsvp.commentLabel}>
						{#snippet children(id)}
							<TextArea
								{id}
								name="comment"
								value={values.comment}
								placeholder={rsvp.commentPlaceholder}
								maxlength={1000}
							/>
						{/snippet}
					</Field>

					<Field label={rsvp.telegramLabel}>
						{#snippet children(id)}
							<TextInput
								{id}
								name="telegramUsername"
								value={values.telegramUsername}
								placeholder={rsvp.telegramPlaceholder}
								maxlength={64}
								autocomplete="off"
								autocapitalize="none"
								aria-describedby="{id}-hint"
							/>
							<p id="{id}-hint" class="text-sm text-muted">{rsvp.telegramHint}</p>
						{/snippet}
					</Field>

					<Button variant="solid" type="submit" loading={pending}>
						{data.answered ? rsvp.save : rsvp.submit}
					</Button>
				</form>
			{/if}
		</div>
	</Section>
</main>

<style>
	/* Pure CSS, so declining hides the menu with or without JavaScript. */
	.rsvp:has(:global(input[name='attending'][value='no']:checked)) .details {
		display: none;
	}

	.companion:not(:has(:global(input[name='companion']:checked))) .companion-fields {
		display: none;
	}
</style>
