# Academic Website — Light Theme, Multi‑page, BibTeX Auto‑Import, Related Pubs

- Publications auto‑render from `assets/publications.bib`
- Projects page with figures and detailed subpages
- Each project subpage shows a **Related publications** section, auto‑filtered by keyword tags (fallback to text match)
- Photos gallery reads images named `photo-*.jpg` in `assets/photos/`

## Tip: Tag your .bib
Add a `keywords = { ... }` field to entries so the related section can find them. Example:
```
keywords = {fluid-inclusions, halite, lithium}
```

## Deploy
1) Create a repo (e.g., `<username>.github.io`), upload files to `main`.
2) Settings → Pages → Deploy from a branch: `main` (root) or use the workflow.
3) (Optional) Add a `CNAME` for a custom domain and configure DNS.
