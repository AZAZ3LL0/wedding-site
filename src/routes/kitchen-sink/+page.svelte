<script lang="ts">
	import {
		AudioToggle,
		Button,
		CheckboxGroup,
		Collage,
		Countdown,
		Divider,
		Field,
		Heading,
		MapCard,
		RadioGroup,
		Reveal,
		Section,
		TextArea,
		TextInput,
		TimelineItem,
		Toast
	} from '$lib/ui';
	import { colorTokens, fontTokens, sample, specimen } from './fixtures';

	let attendance = $state('yes');
	let drinks = $state<string[]>([]);
</script>

{#snippet block(name: string, content: import('svelte').Snippet)}
	<article data-primitive={name} class="flex flex-col gap-4">
		<h2 class="font-mono text-xs tracking-widest text-muted uppercase">{name}</h2>
		{@render content()}
	</article>
{/snippet}

<main class="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-section">
	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		{#each colorTokens as token (token)}
			<figure class="flex flex-col gap-2">
				<div
					class="h-20 rounded-token border border-muted/40"
					style:background-color="var({token})"
					data-token={token}
				></div>
				<figcaption class="font-mono text-xs text-muted">{token}</figcaption>
			</figure>
		{/each}
	</section>

	<section class="flex flex-col gap-6">
		{#each fontTokens as font (font.token)}
			<figure class="flex flex-col gap-1">
				<p class={font.className} data-token={font.token}>{specimen}</p>
				<figcaption class="font-mono text-xs text-muted">{font.token}</figcaption>
			</figure>
		{/each}
	</section>

	{#snippet section()}
		<Section variant="dark"><p>{sample.paragraph}</p></Section>
		<Section variant="light" padded={false}><p>{sample.paragraph}</p></Section>
	{/snippet}
	{@render block('Section', section)}

	{#snippet heading()}
		<Heading level={1} script>{sample.heading}</Heading>
		<Heading level={2}>{sample.heading}</Heading>
		<Heading level={3}>{sample.heading}</Heading>
	{/snippet}
	{@render block('Heading', heading)}

	{#snippet divider()}
		<Divider orientation="horizontal" />
		<Divider orientation="vertical" />
	{/snippet}
	{@render block('Divider', divider)}

	{#snippet countdown()}
		<Countdown target={sample.countdown.target} labels={sample.countdown.labels} />
	{/snippet}
	{@render block('Countdown', countdown)}

	{#snippet collage()}
		<Collage images={sample.collage} />
	{/snippet}
	{@render block('Collage', collage)}

	{#snippet timeline()}
		<div class="flex flex-col gap-6">
			{#each sample.timeline as item (item.time)}
				<TimelineItem {...item} />
			{/each}
		</div>
	{/snippet}
	{@render block('TimelineItem', timeline)}

	{#snippet map()}
		<MapCard {...sample.map} />
	{/snippet}
	{@render block('MapCard', map)}

	{#snippet audio()}
		<AudioToggle src={sample.audio.src} labels={sample.audio.labels} />
	{/snippet}
	{@render block('AudioToggle', audio)}

	{#snippet button()}
		<div class="flex flex-wrap gap-3">
			<Button variant="solid" type="submit">{sample.buttons.solid}</Button>
			<Button variant="ghost">{sample.buttons.ghost}</Button>
			<Button variant="solid" loading>{sample.buttons.loading}</Button>
		</div>
	{/snippet}
	{@render block('Button', button)}

	{#snippet field()}
		<Field label={sample.field.label} required>
			{#snippet children(id)}
				<TextInput {id} name="name" placeholder={sample.field.placeholder} maxlength={120} />
			{/snippet}
		</Field>
		<Field label={sample.field.label} error={sample.field.error}>
			{#snippet children(id)}
				<TextInput {id} name="name-error" aria-invalid="true" aria-describedby="{id}-error" />
			{/snippet}
		</Field>
	{/snippet}
	{@render block('Field', field)}

	{#snippet textInput()}
		<TextInput name="plain" placeholder={sample.field.placeholder} maxlength={60} />
	{/snippet}
	{@render block('TextInput', textInput)}

	{#snippet textArea()}
		<TextArea name="comment" placeholder={sample.field.comment} maxlength={1000} />
	{/snippet}
	{@render block('TextArea', textArea)}

	{#snippet radioGroup()}
		<RadioGroup name="attending" options={sample.attendance} bind:value={attendance} />
	{/snippet}
	{@render block('RadioGroup', radioGroup)}

	{#snippet checkboxGroup()}
		<Field label={sample.drinks.label}>
			{#snippet children(id)}
				<CheckboxGroup
					aria-labelledby="{id}-label"
					name="drinks"
					options={sample.drinks.options}
					max={2}
					bind:values={drinks}
				/>
			{/snippet}
		</Field>
	{/snippet}
	{@render block('CheckboxGroup', checkboxGroup)}

	{#snippet toast()}
		<Toast kind="ok" text={sample.toasts.ok} />
		<Toast kind="error" text={sample.toasts.error} />
	{/snippet}
	{@render block('Toast', toast)}

	<!-- Last on the page with a tall gap, so the second block starts below the fold. -->
	{#snippet revealDemo()}
		<Reveal><p class="font-display text-3xl">{sample.heading}</p></Reveal>
		<div class="h-[150vh]"></div>
		<Reveal delay={150} y={40}><p class="font-display text-3xl">{sample.heading}</p></Reveal>
	{/snippet}
	{@render block('Reveal', revealDemo)}
</main>
