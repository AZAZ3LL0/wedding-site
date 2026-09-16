<script lang="ts">
	import { displayScript } from './script-text';

	type Props = { text: string };

	let { text }: Props = $props();
</script>

<!-- The swapped glyph is for the eye only; assistive tech reads the Russian original. -->
<span aria-hidden="true">{displayScript(text)}</span><span class="sr-only">{text}</span>
