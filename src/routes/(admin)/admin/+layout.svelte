<script lang="ts">
	import { admin } from '$lib/content/admin';

	let { children } = $props();
</script>

<svelte:head>
	<title>{admin.title}</title>
	<!-- Internal tool: keep it out of search results even if the URL leaks. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<!--
	The admin has its own visual world: a system font stack and a plain white surface, so it never
	reads as a page of the invitation (tech.md §8).
-->
<div class="min-h-screen bg-white font-sans text-[15px] leading-normal text-slate-900">
	{@render children()}
</div>
