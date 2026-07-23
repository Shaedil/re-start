import fs from 'fs'
import path from 'path'

export function simpleIconsVirtualModules() {
    const cssModuleId = 'virtual:simple-icons.css'
    const cssResolvedId = '\0' + cssModuleId
    const slugsModuleId = 'virtual:simple-icons-slugs'
    const slugsResolvedId = '\0' + slugsModuleId

    function readIcons() {
        const iconsPath = path.resolve(
            'node_modules/simple-icons-font/font/simple-icons.json'
        )
        return JSON.parse(fs.readFileSync(iconsPath, 'utf-8'))
    }

    function buildCss(icons) {
        const lines = [
            '/* Auto-generated virtual module from simple-icons-font */',
            '@font-face {',
            "    font-family: 'Simple Icons';",
            "    src: url('simple-icons-font/font/SimpleIcons.woff2') format('woff2');",
            '    font-display: block;',
            '}',
            '',
            '.si {',
            "    font-family: 'Simple Icons', sans-serif;",
            '    font-style: normal;',
            '    vertical-align: middle;',
            '}',
        ]

        for (const icon of icons) {
            lines.push(
                '',
                `.si-${icon.slug}::before {`,
                `    content: '\\${icon.code}';`,
                '}'
            )
        }

        return lines.join('\n') + '\n'
    }

    function buildSlugsModule(icons) {
        const slugs = icons.map((icon) => icon.slug).sort()
        return [
            '// Auto-generated virtual module from simple-icons-font',
            'export const validSlugs = new Set([',
            ...slugs.map((slug) => `    '${slug}',`),
            '])',
            '',
        ].join('\n')
    }

    return {
        name: 'simple-icons-virtual-modules',
        resolveId(id) {
            if (id === cssModuleId) return cssResolvedId
            if (id === slugsModuleId) return slugsResolvedId
            return null
        },
        load(id) {
            if (id === cssResolvedId || id === slugsResolvedId) {
                const icons = readIcons()
                if (id === cssResolvedId) return buildCss(icons)
                return buildSlugsModule(icons)
            }
            return null
        },
        handleHotUpdate(ctx) {
            if (
                ctx.file.endsWith(
                    path.normalize(
                        'node_modules/simple-icons-font/font/simple-icons.json'
                    )
                )
            ) {
                const cssModule = ctx.server.moduleGraph.getModuleById(
                    cssResolvedId
                )
                const slugsModule = ctx.server.moduleGraph.getModuleById(
                    slugsResolvedId
                )
                if (cssModule) ctx.server.moduleGraph.invalidateModule(cssModule)
                if (slugsModule)
                    ctx.server.moduleGraph.invalidateModule(slugsModule)
            }
        },
    }
}
