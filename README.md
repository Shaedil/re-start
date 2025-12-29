# re-start

a tui-style browser startpage, built with svelte.

features:

- task list with multiple backend options (local, todoist, google tasks (chrome only))
- smart task input with natural date and project parsing
- weather summary (from open-meteo)
- customizable quick links
- stats (load time, ping, fps, viewport size)
- multiple color themes
- custom css support
- lightweight & performant (~100kb including fonts, loads in <50ms)

<img width="2331" height="1319" alt="image" src="https://github.com/user-attachments/assets/e3164af7-fc42-4caf-81ee-a049e05b84c7" />

## installation

### firefox

1. go to <https://addons.mozilla.org/en-US/firefox/addon/d004c62a8aed4f3b8ddd/>.
2. click "Add to Firefox".
3. make sure to click "Add" and "Keep Changes" when prompted.

### chrome/edge

1. go to <https://chromewebstore.google.com/detail/re-start/fdodcmjeojbmcgmhcgcelffcekhicnop>.
2. click "Add to [Browser]".
3. make sure to click "Add extension" and "Keep it" when prompted.

## usage tips

- hover your cursor on the top right corner of the startpage to see the settings button.
- you can force a refresh of the weather and task widgets by clicking the panel labels "weather" and "tasks".
- to get your todoist api token, sign into todoist and go to <https://app.todoist.com/app/settings/integrations/developer>. click "Copy API Token".
- the 'x tasks' text is a clickable link to either <https://app.todoist.com/app> or <https://tasks.google.com>.
- use smart date input when adding tasks: type naturally like "tomorrow", "friday", "dec 25", "jan 1 3pm", etc.
- assign tasks to projects (todoist) or lists (google tasks) by typing `#projectname` anywhere in the task input.
- drag the "=" handle to reorder links in the settings
- the ping stat is based on how long a request to <https://www.google.com/generate_204> takes. don't take it too seriously.
- here's a matching [firefox color theme](https://color.firefox.com/?theme=XQAAAAK3BAAAAAAAAABBqYhm849SCicxcUhA3DJozHnOMuotJJDtxcajvY2nrbwtWf53IW6FuMhmsQBmHjQtYV0LyoGIJnESUiSA8WGCMfXU1SYqmE_CaU8iA8bQXAYc2jrXIT6bjoi8T-cSTCi2_9o7kcESfauVKnMZKEKJIeeuT9qsP4Z_T2ya4LBqvZWjm1-pHOmWMq1OU0wrgs4bkzHQWozn4dcm22eBmWyWR55FkcmEsPvvHzhHCZ2ZMQrPXQqrOBLr79GTkJUGa5oslhWTp2LYqdD2gNQ1a8_c5-F91bPVmQerXZWpp-OZ11D1Ai6t1ydqjbVKD3RrGXYJwhcQaAxCKa_ft4VoGrVBq8AXYeJOZdXuOxnYXGhOXXSK_NybBfJLm-2W28qSSdoiW0pTL-iFan3xQQeC0WlSrnRYrRjh7HkgLuI-Ft8Fq5kNC7nVXoo8j9Ml_q2AO_RhE116j_MECbspxaJP58juayX_wNty3V2g5zUsf0gSqpEWGT02oZAF2z6LABKRWTO28wIoMUDvj9WAQGsup95WAmNW7g4WMEIgaiJhmBz9koq0wV7gHQtJB_0x2lJ7WQ488bJi8LvqnW-VT3kZ3GJtyv-yXmRJ)!

## development / build from source

1. clone this repo.
2. run `npm i` (you must have node.js).
3. run `npm run dev` to run just the webpage in dev mode at `http://localhost:5173`.
4. run `npm run watch` to build the extension and watch for changes. this can be used with `web-ext run` to test in firefox.
5. run `npm run build:firefox` or `npm run build:chrome:prod` to build for production. the built extension will output to `dist/firefox` or `dist/chrome` respectively.
