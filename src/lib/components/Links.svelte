<script>
    import { settings } from '../stores/settings-store.svelte.js'
    import { isValidSlug } from '../utils/link-icons.js'

    // Simple Icons drops brands on trademark grounds, so common sites such as
    // Outlook, Word, Amazon, LinkedIn and Slack have no glyph at all. In icon
    // mode those fall back to the site's initial rather than the arrow, which
    // keeps the column aligned and still tells the links apart.
    function monogram(title) {
        const match = (title || '').match(/[a-z0-9]/i)
        return match ? match[0].toUpperCase() : '•'
    }

    const columns = $derived.by(() => {
        const result = []
        const linksPerColumn = Math.max(
            1,
            parseInt(settings.linksPerColumn) || 1
        )
        for (let i = 0; i < settings.links.length; i += linksPerColumn) {
            result.push(settings.links.slice(i, i + linksPerColumn))
        }
        return result
    })
</script>

<div class="panel-wrapper">
    <div class="panel-label">links</div>
    <div class="panel">
        {#each columns as column}
            <div
                class="column"
                class:icon-mode={settings.linkIconMode === 'icons'}
            >
                {#each column as link}
                    <a
                        href={link.url}
                        target={settings.linkTarget}
                        rel="noopener noreferrer"
                        class="link"
                    >
                        {#if settings.linkIconMode !== 'none'}
                            {#if settings.linkIconMode === 'icons' && isValidSlug(link.icon)}
                                <span class="icon si si-{link.icon}"></span>
                            {:else if settings.linkIconMode === 'icons'}
                                <span class="icon monogram"
                                    >{monogram(link.title)}</span
                                >
                            {:else}
                                <span class="prefix">></span>
                            {/if}
                        {/if}
                        {#if settings.linkHotkeys && settings.linkHotkeyPosition === 'left'}
                            <span class="hotkey" class:empty={!link.hotkey}
                                >{link.hotkey ? `[${link.hotkey}]` : ''}</span
                            >
                        {/if}
                        <span class="title">{link.title}</span>
                        {#if settings.linkHotkeys && link.hotkey && settings.linkHotkeyPosition === 'right'}
                            <span class="hotkey right">[{link.hotkey}]</span>
                        {/if}
                    </a>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .panel {
        display: flex;
        gap: 1.5rem;
    }
    .column {
        display: flex;
        flex-direction: column;
    }
    .link {
        display: inline-flex;
        width: 100%;
        gap: 1ch;
        align-items: center;
    }
    .link:hover .title {
        color: var(--txt-1);
    }
    .prefix,
    .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .prefix {
        color: var(--txt-green);
    }
    .icon {
        color: var(--txt-link);
    }
    .icon-mode .prefix,
    .icon {
        width: 1rem;
    }
    .icon {
        font-size: 0.875rem;
        vertical-align: text-bottom;
    }
    .monogram {
        font-size: 0.8rem;
        font-weight: 700;
    }
    .column {
        flex-grow: 1;
    }
    .hotkey {
        color: var(--txt-violet);
        width: 3ch;
    }
    .hotkey.right {
        margin-left: auto;
        width: auto;
    }
</style>
