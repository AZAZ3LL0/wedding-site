<script lang="ts">
	type Props = { time: string; title: string; caption: string; icon: 'pin' | 'rings' | 'dish' };

	let { time, title, caption, icon }: Props = $props();
</script>

<div class="grid grid-cols-[auto_1fr] items-start gap-x-4">
	<svg
		viewBox="0 0 24 24"
		class="h-8 w-8 text-accent"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if icon === 'pin'}
			<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
			<circle cx="12" cy="9.5" r="2.5" />
		{:else if icon === 'rings'}
			<circle cx="9" cy="14" r="5" />
			<circle cx="15" cy="14" r="5" />
			<path d="m10 5 2-2 2 2" />
		{:else}
			<path d="M4 14a8 8 0 0 1 16 0Z" />
			<path d="M2 17h20M12 6V4" />
		{/if}
	</svg>
	<div>
		<p class="font-display text-2xl lining-nums tabular-nums">{time}</p>
		<p class="font-medium">{title}</p>
		<p class="text-sm text-accent">{caption}</p>
	</div>
</div>
