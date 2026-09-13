<script lang="ts">
	type Props = { kind: 'ok' | 'error'; text: string };

	let { kind, text }: Props = $props();
</script>

<div
	role={kind === 'error' ? 'alert' : 'status'}
	class={[
		'rounded-token px-4 py-3 text-sm shadow-sm',
		kind === 'ok' ? 'bg-forest text-paper' : 'bg-ink text-paper'
	]}
>
	{text}
</div>
