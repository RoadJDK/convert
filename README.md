# Maibach Convert

Lokaler Bild- und Video-Converter fuer `convert.maibach-systems.ch`.

## Stack

- Astro
- React Islands
- Bun
- Tailwind CSS
- Cloudflare Workers Static Assets

## Local Development

```sh
bun install
bun run dev
```

The local dev server uses `http://localhost:8080`.

## Verification

```sh
bun run test
bun run check
bun run lint
bun run build
bunx wrangler deploy --dry-run
```

## Deployment

Production deploys to the default Cloudflare Workers URL:

```sh
bun run deploy
```
