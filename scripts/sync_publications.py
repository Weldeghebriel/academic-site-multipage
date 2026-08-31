#!/usr/bin/env python3
"""
Sync new publications into assets/publications.bib.

Discovery uses the ORCID public API (free, unauthenticated, and — unlike
scraping Google Scholar — not blocked from CI IP ranges). For each DOI that
ORCID lists and publications.bib does not already contain, metadata is pulled
from the Crossref REST API.

This script only ever *appends*. It never rewrites or deletes an existing
entry, so hand-curated fields (keywords, and the in-review / in-preparation
manuscripts that have no DOI yet) survive every sync.

Two filters keep the list clean:
  * only Crossref type "journal-article" is added, so the conference
    abstracts ORCID also lists (GSA, AGU, Goldschmidt) are skipped;
  * a normalized-title check catches papers already in the .bib under a
    hand-written entry that predates the DOI being registered.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ORCID_ID = "0000-0002-0095-6235"
BIB_PATH = Path(__file__).resolve().parent.parent / "assets" / "publications.bib"
UA = "Mozilla/5.0 (compatible; academic-site-sync/1.0; +https://mebrahtuweldeghebriel.org/)"

# Crossref types worth listing on the site. Abstracts and proceedings are noise.
ALLOWED_TYPES = {"journal-article", "book-chapter"}


def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def orcid_dois():
    url = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
    data = fetch_json(url, {"Accept": "application/json", "User-Agent": UA})
    dois = set()
    for group in data.get("group", []):
        for ext in group.get("external-ids", {}).get("external-id", []):
            if ext.get("external-id-type") == "doi":
                dois.add(ext["external-id-value"].strip().lower())
    return dois


def existing_dois(bib_text):
    return {m.group(1).strip().lower() for m in re.finditer(r"doi\s*=\s*\{([^}]+)\}", bib_text)}


def norm_title(s):
    """Lowercase, strip everything but letters and digits — so '[Ca2+] and
    [SO4 2-] in ...' matches Crossref's differently-punctuated version."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def existing_titles(bib_text):
    return {norm_title(m.group(1)) for m in re.finditer(r"title\s*=\s*\{(.+?)\},?\s*\n", bib_text, re.S)}


def escape_bib(s):
    """Keep stray braces/backslashes from Crossref out of the .bib grammar."""
    return (s or "").replace("\\", "").replace("{", "").replace("}", "").strip()


def crossref_work(doi):
    url = f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}"
    return fetch_json(url, {"User-Agent": UA})["message"]


def bib_entry(doi, msg):
    title = escape_bib((msg.get("title") or [""])[0])
    journal = escape_bib((msg.get("container-title") or [""])[0])
    volume = escape_bib(msg.get("volume", ""))
    pages = escape_bib(msg.get("page", ""))

    year = ""
    for key in ("published-print", "published-online", "published", "issued"):
        parts = msg.get(key, {}).get("date-parts")
        if parts and parts[0] and parts[0][0]:
            year = str(parts[0][0])
            break

    authors = []
    for a in msg.get("author") or []:
        family, given = escape_bib(a.get("family", "")), escape_bib(a.get("given", ""))
        if family:
            authors.append(f"{family}, {given}".strip(", "))
    author_str = " and ".join(authors) if authors else "Weldeghebriel, M. F. and others"

    first = re.sub(r"[^A-Za-z]", "", authors[0].split(",")[0]) if authors else "Auto"
    citekey = f"{first}{year}Auto"

    lines = [f"@article{{{citekey},", f"  author = {{{author_str}}},", f"  title = {{{title}}},"]
    if journal:
        lines.append(f"  journal = {{{journal}}},")
    if volume:
        lines.append(f"  volume = {{{volume}}},")
    if pages:
        lines.append(f"  pages = {{{pages}}},")
    if year:
        lines.append(f"  year = {{{year}}},")
    lines.append(f"  doi = {{{doi}}},")
    lines.append("  keywords = {auto-synced}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main():
    bib_text = BIB_PATH.read_text(encoding="utf-8")
    have_dois = existing_dois(bib_text)
    have_titles = existing_titles(bib_text)

    try:
        found = orcid_dois()
    except Exception as e:
        # Non-fatal: a flaky API should not fail the scheduled run.
        print(f"ORCID fetch failed: {e}", file=sys.stderr)
        return 0

    additions = []
    for doi in sorted(found - have_dois):
        try:
            msg = crossref_work(doi)
        except Exception as e:
            print(f"Skipping {doi}: Crossref lookup failed ({e})", file=sys.stderr)
            continue

        if msg.get("type") not in ALLOWED_TYPES:
            print(f"Skipping {doi}: type '{msg.get('type')}' is not a paper")
            continue

        title = (msg.get("title") or [""])[0]
        if norm_title(title) in have_titles:
            print(f"Skipping {doi}: already in .bib under a hand-written entry")
            continue

        additions.append(bib_entry(doi, msg))
        have_titles.add(norm_title(title))
        print(f"Added: {doi} — {title[:70]}")

    if not additions:
        print("No new publications found.")
        return 0

    with BIB_PATH.open("a", encoding="utf-8") as f:
        f.write("\n" + "\n".join(additions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
