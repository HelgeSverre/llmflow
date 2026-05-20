<script lang="ts">
	import type { SpanRow } from '$lib/trace/viewport.svelte'
	import { colorFor } from './SpanColors'
	import { formatLatency } from '$lib/utils/format'

	interface Props {
		row: SpanRow
		selected: boolean
		onClick: (id: string) => void
		onToggle: (id: string) => void
	}

	let { row, selected, onClick, onToggle }: Props = $props()

	const INDENT_PX = 14
	const ROW_HEIGHT_PX = 28
</script>

<div
	class="span-row"
	class:selected
	style="height: {ROW_HEIGHT_PX}px"
	onclick={() => onClick(row.id)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') onClick(row.id)
	}}
	role="treeitem"
	aria-selected={selected}
	tabindex="0"
>
	<div class="label-col" style="padding-left: {row.depth * INDENT_PX + 4}px">
		{#if row.hasChildren}
			<button
				class="caret"
				onclick={(e) => {
					e.stopPropagation()
					onToggle(row.id)
				}}
				aria-label="Toggle"
			>
				▸
			</button>
		{:else}
			<span class="caret-spacer"></span>
		{/if}
		<span class="span-name" title={row.name}>{row.name}</span>
		<span class="span-type">{row.span_type ?? ''}</span>
	</div>
	<div class="bar-col">
		<div
			class="span-bar"
			style:left="{row.xPx}px"
			style:width="{row.widthPx}px"
			style:background-color={colorFor(row.span_type)}
		></div>
	</div>
	<div class="duration-col">{formatLatency(row.duration_ms)}</div>
</div>

<style>
	.span-row {
		display: grid;
		grid-template-columns: minmax(220px, 35%) 1fr 80px;
		align-items: center;
		cursor: pointer;
		border-bottom: 1px solid var(--row-border, rgba(0, 0, 0, 0.05));
		font-size: 13px;
	}
	.span-row:hover {
		background: var(--row-hover, rgba(0, 0, 0, 0.03));
	}
	.span-row.selected {
		background: var(--row-selected, rgba(0, 120, 215, 0.12));
	}

	.label-col {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
	}
	.caret {
		background: none;
		border: 0;
		cursor: pointer;
		padding: 0 4px;
		color: var(--muted);
	}
	.caret-spacer {
		display: inline-block;
		width: 16px;
	}
	.span-name {
		font-family: var(--font-mono, ui-monospace, monospace);
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}
	.span-type {
		font-size: 11px;
		opacity: 0.6;
	}

	.bar-col {
		position: relative;
		height: 100%;
	}
	.span-bar {
		position: absolute;
		top: 8px;
		height: 12px;
		border-radius: 3px;
	}

	.duration-col {
		text-align: right;
		padding-right: 8px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--muted);
	}
</style>
