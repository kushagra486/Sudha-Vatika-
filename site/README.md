# Sudha Vatika: public website

A plain HTML and CSS site, with no build step and no framework. Netlify publishes this folder as it is (see `netlify.toml`).

## Status: blank template

Every place that still needs real content is marked with the CSS class `todo` and a `TODO` comment. To find them all:

```
grep -n "TODO" site/index.html
```

- Photos go in `site/images/`. Replace each `<div class="ph">` placeholder with an `<img>` pointing at the new file.
- The page has `<meta name="robots" content="noindex">`, which stops Google listing a half-built site. **Remove that line at launch.**

## Still to add

- Photos and videos: hero, each space, gallery.
- Address, Google Maps embed, phone and WhatsApp number, email.
- About text, facilities list, Google review link.
- The enquiry form: next step is to send entries straight into the dashboard as enquiries.
