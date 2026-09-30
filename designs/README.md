# Shared designs

Put other people's website designs in this folder, one folder per design:

    designs/
      maya-winter-concept/
        index.html
        styles.css
        images/...

Each folder needs an `index.html` (or list another start page in `manifest.json`).
They show up automatically in the design picker under "Community designs":

- Running locally with `start-server-mac.command`: just drop the folder in and refresh.
- Hosted on GitHub Pages: commit the folder to the repo; the picker finds it through the GitHub API.
- Anywhere else: add it to `manifest.json`, for example
  `[{"folder": "maya-winter-concept", "name": "Winter Concept", "by": "Maya", "entry": "index.html"}]`
