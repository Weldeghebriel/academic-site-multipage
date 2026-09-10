# Academic Website — Mebrahtu F. Weldeghebriel

Static multi-page site, deployed to [mebrahtuweldeghebriel.org](https://mebrahtuweldeghebriel.org) via Netlify
(auto-deploys on push to `main`). No build step — plain HTML/CSS/JS.

## Structure
- `index.html` — home / hero / about / research overview / news teaser
- `projects.html` — established research + 5 proposed future directions (each with an SVG illustration)
- `publications.html` — searchable, filterable list rendered from `assets/publications.bib`
- `cv.html` — education, grants & fellowships, honors, industry experience, skills (links to the full PDF)
- `teaching.html`, `talks.html`, `news.html`, `photos.html`, `contact.html`
- `assets/pubs.js` — shared BibTeX parser/renderer used by publications.html and all project pages
- `assets/site.js` — mobile nav toggle + active-link highlighting, shared across all pages
- `assets/*.svg` — hand-drawn schematic illustrations (existing project figures + 5 new "future direction" figures)
- `assets/cv/Mebrahtu_Weldeghebriel_CV.pdf` — downloadable CV

## Publications: automatic sync
`.github/workflows/sync-publications.yml` runs weekly (and on-demand via "Run workflow") and calls
`scripts/sync_publications.py`, which:
1. Reads the DOI list from the public ORCID API (ORCID `0000-0002-0095-6235`) — no login or scraping involved.
2. For any DOI not already in `assets/publications.bib`, pulls full metadata (authors, journal, volume,
   pages, year) from the Crossref REST API.
3. **Appends** new entries only. It never edits or removes an existing entry, so manually curated fields
   (`keywords`, `note = {in review}` / `note = {in preparation}` on not-yet-published manuscripts) are safe.
4. Commits directly to `main` if anything changed, which triggers a normal Netlify deploy.

We use ORCID + Crossref rather than scraping Google Scholar because Scholar has no public API and routinely
blocks scraper requests (including CAPTCHAs) from cloud/CI IP ranges — it's not reliable enough for an
unattended scheduled job. Keep your ORCID profile's works list up to date and new papers will flow onto the
site automatically. Manuscripts still in review or in preparation (which have no DOI yet) must still be
added/edited by hand in `assets/publications.bib`, since there's nothing on ORCID to auto-discover.

Tag entries with `keywords = {...}` so the "related publications" widgets on `projects.html` and each
project subpage can find them.

## Photos
Add images to `assets/photos/` named `photo-1.jpg`, `photo-2.jpg`, … up to `photo-8.jpg` (edit `TOTAL_SLOTS`
in `photos.html` to add more slots). Missing files degrade gracefully to a placeholder card rather than a
broken-image icon.

## Deploy
Netlify is already connected to this repo (publish directory: `/`, no build command). Any push to `main`
redeploys automatically.
