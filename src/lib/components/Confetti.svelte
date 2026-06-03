<script>
    import { onDestroy } from 'svelte'

    // Theme accent CSS variables — the burst adapts to the active theme.
    const COLORS = [
        '--txt-num',
        '--txt-link',
        '--txt-green',
        '--txt-violet',
        '--txt-orange',
        '--txt-magenta',
    ]

    // Monospace-friendly glyphs that read as celebratory sparks.
    const GLYPHS = ['✦', '✧', '⋆', '*', '+', '•', '◦']

    const PARTICLE_COUNT = 18
    const MAX_PARTICLES = 140
    const GRAVITY = 0.16 // px per frame² (normalized to 60fps)
    const DRAG = 0.98 // fraction of velocity retained per frame
    const FADE = 0.018 // life lost per frame

    let particles = $state([])
    let nextId = 0
    let frame = null
    let lastTime = 0

    const rand = (min, max) => min + Math.random() * (max - min)
    const pick = (arr) => arr[(Math.random() * arr.length) | 0]
    // Overshoot easing for a playful "pop" on text labels.
    const easeOutBack = (t) => {
        const c1 = 1.70158
        const c3 = c1 + 1
        return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    }

    function prefersReducedMotion() {
        return (
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        )
    }

    function emit(fresh) {
        particles = [...particles, ...fresh].slice(-MAX_PARTICLES)
        if (frame === null) {
            lastTime = performance.now()
            frame = requestAnimationFrame(step)
        }
    }

    // Celebration: particles explode outward from (x, y) and arc away.
    export function burst(x, y) {
        if (prefersReducedMotion()) return

        const fresh = []
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const angle = rand(0, Math.PI * 2)
            const speed = rand(2.5, 6.5)
            fresh.push({
                id: nextId++,
                mode: 'burst',
                char: pick(GLYPHS),
                color: pick(COLORS),
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - rand(1, 3), // slight upward bias
                rot: rand(0, 360),
                vrot: rand(-12, 12),
                scale: rand(0.75, 1.35),
                opacity: 1,
                life: 1,
            })
        }
        emit(fresh)
    }

    // Reverse of the celebration: particles start spread out and are pulled
    // back into (x, y), shrinking as they go — played when a completed task
    // is un-completed.
    export function implode(x, y) {
        if (prefersReducedMotion()) return

        const fresh = []
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const angle = rand(0, Math.PI * 2)
            const radius = rand(28, 64)
            const sx = x + Math.cos(angle) * radius
            const sy = y + Math.sin(angle) * radius
            const base = rand(0.75, 1.35)
            fresh.push({
                id: nextId++,
                mode: 'implode',
                char: pick(GLYPHS),
                color: pick(COLORS),
                x: sx,
                y: sy,
                x0: sx,
                y0: sy,
                cx: x,
                cy: y,
                rot: rand(0, 360),
                vrot: rand(-12, 12),
                baseScale: base,
                scale: base,
                opacity: 1,
                age: 0,
                duration: rand(36, 52), // frames (~0.6–0.9s at 60fps)
            })
        }
        emit(fresh)
    }

    // A single playful text label that pops in, drifts up, and fades out.
    export function popText(x, y, text) {
        if (prefersReducedMotion()) return

        emit([
            {
                id: nextId++,
                mode: 'text',
                text,
                color: '--txt-err',
                x,
                x0: x,
                y,
                rot: 0,
                scale: 0,
                opacity: 0,
                age: 0,
                duration: rand(64, 78), // frames (~1.1–1.3s at 60fps)
            },
        ])
    }

    function step(now) {
        // Normalize to 60fps frames so motion is consistent across refresh rates.
        const dt = Math.min((now - lastTime) / 16.667, 3)
        lastTime = now

        const survivors = []
        for (const p of particles) {
            if (p.mode === 'text') {
                p.age += dt
                const progress = Math.min(p.age / p.duration, 1)
                p.x = p.x0 - 10 * (1 - (1 - progress) ** 2) // drift left
                p.scale = easeOutBack(Math.min(progress / 0.3, 1)) // pop in
                const fadeIn = Math.min(progress / 0.12, 1)
                const fadeOut = progress > 0.7 ? (1 - progress) / 0.3 : 1
                p.opacity = fadeIn * fadeOut
                if (progress < 1) survivors.push(p)
            } else if (p.mode === 'implode') {
                p.age += dt
                const progress = Math.min(p.age / p.duration, 1)
                const eased = progress * progress * progress // ease-in: pulled in faster as it nears the center
                p.x = p.x0 + (p.cx - p.x0) * eased
                p.y = p.y0 + (p.cy - p.y0) * eased
                p.rot += p.vrot * dt
                p.scale = p.baseScale * (1 - 0.85 * progress)
                p.opacity = 1 - progress * progress
                if (progress < 1) survivors.push(p)
            } else {
                p.vx *= DRAG
                p.vy = p.vy * DRAG + GRAVITY * dt
                p.x += p.vx * dt
                p.y += p.vy * dt
                p.rot += p.vrot * dt
                p.life -= FADE * dt
                p.opacity = Math.min(1, p.life * 1.4)
                if (p.life > 0) survivors.push(p)
            }
        }
        particles = survivors

        frame = particles.length > 0 ? requestAnimationFrame(step) : null
    }

    onDestroy(() => {
        if (frame !== null) cancelAnimationFrame(frame)
    })
</script>

{#if particles.length > 0}
    <div class="confetti" aria-hidden="true">
        {#each particles as p (p.id)}
            <span
                class="particle"
                class:text-pop={p.mode === 'text'}
                style="transform: translate({p.x}px, {p.y}px) translate({p.mode === 'text' ? '-100%, -50%' : '-50%, -50%'}) rotate({p.rot}deg) scale({p.scale}); color: var({p.color}); opacity: {p.opacity};"
                >{p.mode === 'text' ? p.text : p.char}</span
            >
        {/each}
    </div>
{/if}

<style>
    .confetti {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 9999;
    }
    .particle {
        position: absolute;
        top: 0;
        left: 0;
        font-size: 0.85rem;
        line-height: 1;
        will-change: transform, opacity;
        user-select: none;
    }
    .text-pop {
        font-size: 0.95rem;
        font-weight: 600;
        white-space: nowrap;
        letter-spacing: 0.02em;
        transform-origin: 100% 50%;
    }
</style>
