<script lang="ts">
	import { admin } from '$lib/content/admin';

	let { data, form } = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
	<h1 class="mb-6 text-2xl font-semibold">{admin.login.title}</h1>

	{#if data.configured}
		<form method="post" class="flex flex-col gap-3">
			<label class="text-sm font-medium" for="admin-password">{admin.login.passwordLabel}</label>
			<input
				id="admin-password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				aria-describedby={form?.error ? 'admin-password-error' : undefined}
				class="min-h-11 rounded border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
			/>
			{#if form?.error}
				<p id="admin-password-error" class="text-sm text-red-700">{admin.login.failed}</p>
			{/if}
			<button
				type="submit"
				class="min-h-11 rounded bg-slate-900 px-4 font-medium text-white hover:bg-slate-700"
			>
				{admin.login.submit}
			</button>
		</form>
	{:else}
		<p class="text-sm text-red-700">{admin.login.disabled}</p>
	{/if}
</main>
