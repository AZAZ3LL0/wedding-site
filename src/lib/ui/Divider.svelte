<script lang="ts">
	type Props = { orientation: 'vertical' | 'horizontal' };

	let { orientation }: Props = $props();
</script>

{#if orientation === 'horizontal'}
	<hr class="mx-auto w-16 border-0 border-t border-current opacity-40" />
{:else}
	<div
		role="separator"
		aria-orientation="vertical"
		class="mx-auto h-16 w-px bg-current opacity-40"
	></div>
{/if}
