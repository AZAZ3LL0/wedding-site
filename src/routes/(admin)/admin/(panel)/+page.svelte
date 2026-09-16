<script lang="ts">
	import { admin } from '$lib/content/admin';
</script>

<header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
	<h1 class="text-xl font-semibold">{admin.title}</h1>
	<form method="post" action="?/signOut">
		<button type="submit" class="text-sm text-slate-600 underline hover:text-slate-900">
			{admin.nav.signOut}
		</button>
	</form>
</header>
