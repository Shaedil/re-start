import { validSlugs } from 'virtual:simple-icons-slugs'

// Map of URL hostname patterns to simple-icons slugs.
//
// Every slug here must exist in the installed simple-icons font, otherwise
// isValidSlug() rejects it and the link silently falls back to the `>` prefix.
// Simple Icons drops brands whose trademark policy requires it, so a slug that
// works today can disappear on upgrade — see MISSING_BRANDS below.
const domainToSlug = {
    'mail.google.com': 'gmail',
    'calendar.google.com': 'googlecalendar',
    'drive.google.com': 'googledrive',
    'docs.google.com': 'googledocs',
    'keep.google.com': 'googlekeep',
    'maps.google.com': 'googlemaps',
    'photos.google.com': 'googlephotos',
    'meet.google.com': 'googlemeet',
    'sheets.google.com': 'googlesheets',
    'slides.google.com': 'googleslides',
    'translate.google.com': 'googletranslate',
    'aistudio.google.com': 'googlegemini',
    'claude.ai': 'claude',
    'x.com': 'x',
    'twitter.com': 'x',
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    'reddit.com': 'reddit',
    'youtube.com': 'youtube',
    'music.youtube.com': 'youtubemusic',
    'twitch.tv': 'twitch',
    'discord.com': 'discord',
    'discord.gg': 'discord',
    'netflix.com': 'netflix',
    'spotify.com': 'spotify',
    'open.spotify.com': 'spotify',
    'notion.so': 'notion',
    'figma.com': 'figma',
    'facebook.com': 'facebook',
    'instagram.com': 'instagram',
    'threads.net': 'threads',
    'whatsapp.com': 'whatsapp',
    'web.whatsapp.com': 'whatsapp',
    'telegram.org': 'telegram',
    't.me': 'telegram',
    'medium.com': 'medium',
    'stackoverflow.com': 'stackoverflow',
    'wikipedia.org': 'wikipedia',
    'leetcode.com': 'leetcode',
    'perplexity.ai': 'perplexity',
    'feedly.com': 'feedly',
    'vercel.com': 'vercel',
    'netlify.com': 'netlify',
    'dropbox.com': 'dropbox',
    'trello.com': 'trello',
    'jira.atlassian.com': 'jira',
    'bitbucket.org': 'bitbucket',
    'npmjs.com': 'npm',
    'dev.to': 'devdotto',
    'news.ycombinator.com': 'ycombinator',
    'producthunt.com': 'producthunt',
    'dribbble.com': 'dribbble',
    'behance.net': 'behance',
    'pinterest.com': 'pinterest',
    'tumblr.com': 'tumblr',
    'apple.com': 'apple',
    'icloud.com': 'icloud',
    'proton.me': 'proton',
    'mail.proton.me': 'protonmail',
    'bitwarden.com': 'bitwarden',
    'vault.bitwarden.com': 'bitwarden',
    'todoist.com': 'todoist',
    'linear.app': 'linear',
    'ray.so': 'raycast',
    'arc.net': 'arc',
    'brave.com': 'brave',
    'vivaldi.com': 'vivaldi',

    // google services
    'news.google.com': 'googlenews',
    'chat.google.com': 'googlechat',
    'cloud.google.com': 'googlecloud',
    'analytics.google.com': 'googleanalytics',
    'play.google.com': 'googleplay',
    'scholar.google.com': 'googlescholar',
    'forms.google.com': 'googleforms',
    'gemini.google.com': 'googlegemini',
    'colab.research.google.com': 'googlecolab',

    // ai and machine learning
    'huggingface.co': 'huggingface',
    'kaggle.com': 'kaggle',
    'ollama.com': 'ollama',

    // development
    'stackexchange.com': 'stackexchange',
    'superuser.com': 'superuser',
    'serverfault.com': 'serverfault',
    'codesandbox.io': 'codesandbox',
    'replit.com': 'replit',
    'jsfiddle.net': 'jsfiddle',
    'glitch.com': 'glitch',
    'codeberg.org': 'codeberg',
    'sourceforge.net': 'sourceforge',
    'atlassian.net': 'jira',
    'confluence.atlassian.com': 'confluence',
    'pypi.org': 'pypi',
    'rubygems.org': 'rubygems',
    'crates.io': 'rust',
    'developer.mozilla.org': 'mdnwebdocs',
    'w3schools.com': 'w3schools',

    // infrastructure and hosting
    'railway.app': 'railway',
    'render.com': 'render',
    'fly.io': 'flydotio',
    'digitalocean.com': 'digitalocean',
    'cloudflare.com': 'cloudflare',
    'docker.com': 'docker',
    'hub.docker.com': 'docker',
    'kubernetes.io': 'kubernetes',
    'postman.com': 'postman',
    'sentry.io': 'sentry',
    'datadoghq.com': 'datadog',
    'grafana.com': 'grafana',
    'jenkins.io': 'jenkins',
    'circleci.com': 'circleci',

    // news and reading
    'nytimes.com': 'newyorktimes',
    'theguardian.com': 'theguardian',
    'cnn.com': 'cnn',
    'arstechnica.com': 'arstechnica',
    'techcrunch.com': 'techcrunch',
    'hackernoon.com': 'hackernoon',
    'substack.com': 'substack',

    // social
    'mastodon.social': 'mastodon',
    'bsky.app': 'bluesky',
    'matrix.org': 'matrix',
    'signal.org': 'signal',
    'snapchat.com': 'snapchat',
    'tiktok.com': 'tiktok',
    'lemmy.world': 'lemmy',

    // media
    'vimeo.com': 'vimeo',
    'soundcloud.com': 'soundcloud',
    'bandcamp.com': 'bandcamp',
    'last.fm': 'lastdotfm',
    'plex.tv': 'plex',
    'jellyfin.org': 'jellyfin',
    'imdb.com': 'imdb',
    'letterboxd.com': 'letterboxd',
    'goodreads.com': 'goodreads',
    'crunchyroll.com': 'crunchyroll',
    'myanimelist.net': 'myanimelist',
    'anilist.co': 'anilist',
    'music.apple.com': 'applemusic',
    'tidal.com': 'tidal',
    'deezer.com': 'deezer',

    // shopping and finance
    'etsy.com': 'etsy',
    'ebay.com': 'ebay',
    'aliexpress.com': 'aliexpress',
    'shopify.com': 'shopify',
    'paypal.com': 'paypal',
    'stripe.com': 'stripe',
    'wise.com': 'wise',
    'revolut.com': 'revolut',
    'coinbase.com': 'coinbase',
    'binance.com': 'binance',

    // travel
    'airbnb.com': 'airbnb',
    'booking.com': 'bookingdotcom',
    'uber.com': 'uber',
    'lyft.com': 'lyft',
    'tripadvisor.com': 'tripadvisor',

    // learning
    'coursera.org': 'coursera',
    'udemy.com': 'udemy',
    'edx.org': 'edx',
    'khanacademy.org': 'khanacademy',
    'duolingo.com': 'duolingo',
    'freecodecamp.org': 'freecodecamp',
    'codecademy.com': 'codecademy',

    // notes and productivity
    'obsidian.md': 'obsidian',
    'logseq.com': 'logseq',
    'roamresearch.com': 'roamresearch',
    'zotero.org': 'zotero',
    'overleaf.com': 'overleaf',
    'miro.com': 'miro',
    'excalidraw.com': 'excalidraw',
    'asana.com': 'asana',
    'clickup.com': 'clickup',
    'basecamp.com': 'basecamp',
    'zoom.us': 'zoom',
    'airtable.com': 'airtable',

    // storage
    'mega.nz': 'mega',
    'box.com': 'box',
    'nextcloud.com': 'nextcloud',
    'syncthing.net': 'syncthing',

    // linux and open source
    'archlinux.org': 'archlinux',
    'ubuntu.com': 'ubuntu',
    'debian.org': 'debian',
    'fedoraproject.org': 'fedora',
    'nixos.org': 'nixos',
    'kernel.org': 'linux',

    // games
    'steampowered.com': 'steam',
    'store.steampowered.com': 'steam',
    'epicgames.com': 'epicgames',
    'gog.com': 'gogdotcom',
    'itch.io': 'itchdotio',
    'roblox.com': 'roblox',
    'chess.com': 'chessdotcom',
    'lichess.org': 'lichess',

    // search and reference
    'wolframalpha.com': 'wolfram',
    'archive.org': 'internetarchive',
    'web.archive.org': 'internetarchive',
    'duckduckgo.com': 'duckduckgo',
    'ecosia.org': 'ecosia',
    'startpage.com': 'startpage',
    'kagi.com': 'kagi',
    'mozilla.org': 'firefox',
    'opera.com': 'opera',

    // misc
    'strava.com': 'strava',
    'weather.com': 'theweatherchannel',
    'accuweather.com': 'accuweather',
}

// Brands with no icon in the installed simple-icons build, so they cannot be
// mapped above. Simple Icons removes brands on trademark-policy grounds; these
// were checked against version 16 and each one is absent, not merely renamed.
// Listed so the next person does not re-add a mapping that silently fails.
export const MISSING_BRANDS = [
    'all microsoft products (outlook, word, excel, teams, onedrive, onenote)',
    'amazon',
    'linkedin',
    'openai / chatgpt',
    'slack',
    'canva',
    'codepen',
    'heroku',
    'bbc',
    'reuters',
    'bloomberg',
    'the verge',
    'wired',
    'npr',
    'nintendo',
    'minecraft',
    'midjourney',
]

export function isValidSlug(slug) {
    return validSlugs.has(slug)
}

export function extractDomain(url) {
    try {
        return new URL(url).hostname
    } catch {
        return ''
    }
}

export function guessIconSlug(url) {
    try {
        const hostname = new URL(url).hostname
        // exact match
        if (domainToSlug[hostname]) return domainToSlug[hostname]
        // strip www.
        const noWww = hostname.replace(/^www\./, '')
        if (domainToSlug[noWww]) return domainToSlug[noWww]
        // try base domain (last two parts)
        const parts = noWww.split('.')
        if (parts.length > 2) {
            const base = parts.slice(-2).join('.')
            if (domainToSlug[base]) return domainToSlug[base]
        }
        return null
    } catch {
        return null
    }
}
