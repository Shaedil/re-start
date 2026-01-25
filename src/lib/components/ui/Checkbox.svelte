<script>
    let { checked = $bindable(false), children } = $props()
</script>

<label>
    <input type="checkbox" bind:checked />
    <span class="checkbox-indicator">
        {#if checked}
            [<span class="checkbox-x">x</span>]
        {:else}
            [ ]
        {/if}
    </span>
    <span class="checkbox-content">
        {@render children?.()}
    </span>
</label>

<style>
    label {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        cursor: pointer;
        white-space: nowrap;
    }

    label input[type='checkbox'] {
        display: none;
    }

    .checkbox-indicator {
        color: var(--txt-3);
    }

    .checkbox-x {
        color: var(--txt-2);
    }

    label:hover .checkbox-indicator {
        color: var(--txt-2);
    }
</style>
