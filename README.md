# mebrahtuweldeghebriel.org

Personal academic site — static HTML, no build step, served by GitHub Pages.

**This branch (`simple-minimal`) is design option 1: minimal and typographic.**
White page, one navy serif, generous whitespace, no cards or boxes. The home
page is a single sentence. Compare with branch `simple-lab`.

## Pages

| File | Nav label |
|---|---|
| `index.html` | Home |
| `research.html` | Research |
| `publications.html` | Publications |
| `teaching.html` | Teaching |
| `news.html` | News |
| `contact.html` | Contact |

There is deliberately **no public CV page**. The CV is available on request via
the contact page.

## Publications update themselves

`publications.html` renders `assets/publications.bib` in the browser
(`assets/pubs.js`). The `.bib` is kept current by a GitHub Action:

- **`.github/workflows/sync-publications.yml`** runs every Monday at 13:00 UTC,
  and on demand from the Actions tab (*Run workflow*).
- **`scripts/sync_publications.py`** asks the ORCID public API for your DOIs,
  pulls metadata for any DOI not already in the `.bib` from Crossref, appends
  it, and commits.

So when a new paper appears on your ORCID record, it appears on the site within
a week with no action from you.

The script is **append-only** — it never rewrites or deletes an existing entry.
That means anything you curate by hand is safe, including:

- `keywords` you have added,
- the `@unpublished` entries for manuscripts in review or in preparation, which
  have no DOI yet and cannot come from ORCID.

Two filters keep the list clean:

- only Crossref type `journal-article` / `book-chapter` is added, so the GSA,
  AGU, and EGU **conference abstracts that ORCID also lists are skipped**;
- a normalized-title check prevents a paper from being added twice when it is
  already present as a hand-written entry that predates its DOI.

### When a manuscript in review is accepted

Delete its `@unpublished` entry from `assets/publications.bib`. The next sync
picks the paper up from ORCID as a full `@article` with its DOI. (If you forget,
the title check prevents a duplicate — you will just keep the "in review" note.)

### Configuration

The ORCID iD lives at the top of `scripts/sync_publications.py`:

```python
ORCID_ID = "0000-0002-0095-6235"
```

Run it locally any time with:

```bash
python scripts/sync_publications.py
```

## Editing content

- **News** — copy a `.news-item` block in `news.html` and put it at the top.
- **Research, Teaching, Contact** — plain HTML, edit directly.
- **Publications** — do not edit `publications.html`; edit `assets/publications.bib`.

## Local preview

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. A plain file:// open will not work, because
the publications page fetches the `.bib` over HTTP.
