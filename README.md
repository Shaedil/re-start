# re-start

a tui-style browser startpage, built with svelte.

features:

- task list with multiple backend options (local, todoist, google tasks (chrome only))
- smart task input with natural date and project parsing
- weather summary (from open-meteo)
- pomodoro timer widget
- quotes widget
- notes widget
- customizable quick links
- stats (load time, ping, fps, viewport size)
- privacy blur toggle to obscure sensitive content
- multiple color themes
- custom css support
- lightweight & performant (~100kb including fonts, loads in <50ms)

<img alt="screenshot" src="files/screenshot.png" />

## installation

- For chrome: navigate to chrome://extensions, enable developer mode, load unpacked and select the 'dist/chrome' folder.
- For firefox: navigate to about:debugging, click "This Firefox", click "Load Temporary Add-on" and open 'dist/firefox'.

## usage tips/info

- settings
  - hover over the top right corner to see the settings button.
  - to get your todoist api token, go to <https://app.todoist.com/app/settings/integrations/developer>.
  - drag the "=" to reorder links in the settings.
- tasks
  - you can force refresh the task/weather widgets by clicking the top left panel labels
  - the 'x tasks' text is a clickable link to either <https://app.todoist.com/app> or <https://tasks.google.com>, (note that google tasks does not work in firefox).
  - when adding tasks, you can add due dates by typing naturally like "tmrw", "friday", "dec 25", "jan 1 3pm", etc.
  - assign tasks to projects/lists by typing `#projectname` anywhere in the task input.
  - completed tasks are hidden after 5 minutes.
- the ping stat measures how long a request to <https://www.google.com/generate_204> takes. don't take it too seriously.

## development / build from source

1. clone this repo.
2. run `npm i` (you must have node.js).
3. run `npm run dev` to run just the webpage in dev mode at `http://localhost:5173`.
4. run `npm run watch` to build the extension and watch for changes. this can be used with `web-ext run` to test in firefox.
5. run `npm run build:firefox` or `npm run build:chrome:prod` to build for production. the built extension will output to `dist/firefox` or `dist/chrome` respectively.
