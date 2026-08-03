// Theme metadata
// Actual theme CSS is in themes.css and inlined at build time
// Preview colors are used for the theme selector UI

export const themes = {
    default: {
        displayName: 'default',
        preview: {
            bg: 'oklch(19% 0 0)',
            accent: 'oklch(40% 0 0)',
            text: 'oklch(75% 0 0)',
        },
    },
    'rose-pine': {
        displayName: 'rosé pine',
        preview: {
            bg: '#191724',
            accent: '#ebbcba',
            text: 'hsl(248, 25%, 75%)',
        },
    },
    'catppuccin-mocha': {
        displayName: 'catppuccin mocha',
        preview: {
            bg: '#181825',
            accent: '#cba6f7',
            text: '#a6adc8',
        },
    },
    'catppuccin-latte': {
        displayName: 'catppuccin latte',
        preview: {
            bg: '#eff1f5',
            accent: '#7287fd',
            text: '#4c4f69',
        },
    },
    nord: {
        displayName: 'nord',
        preview: {
            bg: '#2e3440',
            accent: '#88c0d0',
            text: '#d8dee9',
        },
    },
    'tokyo-night': {
        displayName: 'tokyo night',
        preview: {
            bg: '#1a1b26',
            accent: '#7aa2f7',
            text: '#a9b1d6',
        },
    },
    gruvbox: {
        displayName: 'gruvbox',
        preview: {
            bg: '#282828',
            accent: '#fabd2f',
            text: '#d5c4a1',
        },
    },
    everforest: {
        displayName: 'everforest',
        preview: {
            bg: '#272e33',
            accent: '#a7c080',
            text: 'hsl(41, 20%, 65%)',
        },
    },
    kanagawa: {
        displayName: 'kanagawa',
        preview: {
            bg: '#1F1F28',
            accent: '#957FB8',
            text: '#C8C093',
        },
    },
    'solarized-dark': {
        displayName: 'solarized dark',
        preview: {
            bg: '#002b36',
            accent: '#2aa198',
            text: '#839496',
        },
    },
    'solarized-light': {
        displayName: 'solarized light',
        preview: {
            bg: '#fdf6e3',
            accent: '#268bd2',
            text: '#657b83',
        },
    },
    dracula: {
        displayName: 'dracula',
        preview: {
            bg: '#282a36',
            accent: '#bd93f9',
            text: '#f8f8f2',
        },
    },
    'one-dark': {
        displayName: 'one dark',
        preview: {
            bg: '#282c34',
            accent: '#61afef',
            text: '#abb2bf',
        },
    },
    'monokai-pro': {
        displayName: 'monokai pro',
        preview: {
            bg: '#2d2a2e',
            accent: '#ffd866',
            text: '#fcfcfa',
        },
    },
    'ayu-dark': {
        displayName: 'ayu dark',
        preview: {
            bg: '#0b0e14',
            accent: '#e6b450',
            text: '#bfbdb6',
        },
    },
    'ayu-mirage': {
        displayName: 'ayu mirage',
        preview: {
            bg: '#1f2430',
            accent: '#ffcc66',
            text: '#cbccc6',
        },
    },
    'github-dark': {
        displayName: 'github dark',
        preview: {
            bg: '#0d1117',
            accent: '#58a6ff',
            text: '#c9d1d9',
        },
    },
    'material-palenight': {
        displayName: 'material palenight',
        preview: {
            bg: '#292d3e',
            accent: '#c792ea',
            text: '#a6accd',
        },
    },
    oxocarbon: {
        displayName: 'oxocarbon',
        preview: {
            bg: '#161616',
            accent: '#33b1ff',
            text: '#dde1e6',
        },
    },
    'gruvbox-light': {
        displayName: 'gruvbox light',
        preview: {
            bg: '#fbf1c7',
            accent: '#b57614',
            text: '#3c3836',
        },
    },
    nightfox: {
        displayName: 'nightfox',
        preview: {
            bg: '#192330',
            accent: '#719cd6',
            text: '#cdcecf',
        },
    },
    'rose-pine-dawn': {
        displayName: 'rosé pine dawn',
        preview: {
            bg: '#faf4ed',
            accent: '#d7827e',
            text: '#575279',
        },
    },
    'everforest-light': {
        displayName: 'everforest light',
        preview: {
            bg: '#fdf6e3',
            accent: '#8da101',
            text: '#5c6a72',
        },
    },
    'one-light': {
        displayName: 'one light',
        preview: {
            bg: '#fafafa',
            accent: '#4078f2',
            text: '#383a42',
        },
    },
    custom: {
        displayName: 'custom',
        preview: null, // preview comes from settings.customThemeColors
    },
}

export const themeNames = Object.keys(themes)

export const defaultCustomColors = {
    bg1: '#141414',
    bg2: '#1d1d1d',
    bg3: '#262626',
    txt1: '#dedede',
    txt2: '#aeaeae',
    txt3: '#636363',
    txt4: '#484848',
    txtErr: '#d6809c',
    // Accent colors (default to the monochrome default theme; users can recolor)
    txtNum: '#dedede',
    txtLink: '#aeaeae',
    txtGreen: '#aeaeae',
    txtViolet: '#636363',
    txtOrange: '#dedede',
    txtMagenta: '#636363',
}

export const defaultTheme = 'default'
