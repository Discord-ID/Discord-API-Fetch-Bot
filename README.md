# Discord ID API Fetching Bot

This repository is a Discord bot job that fetches collectibles and quests, builds Discord message payloads, and posts them directly through the Discord REST API.

## What this project does

- Fetches live collectibles and quests data from configured APIs
- Builds announcement messages and thread payloads
- Posts results to Discord channels using a bot token
- Persists state in `state.json` to avoid reposting the same items
- Runs automatically on GitHub Actions using repository secrets

## How to deploy with GitHub Actions

The bot is configured to run from `.github/workflows/api.yml`.
This workflow now uses GitHub Secrets instead of a local `.env` file.

### Required repository secrets

Set these secrets in GitHub: `Settings > Secrets and variables > Actions`.

- `DISCORD_BOT_TOKEN`
- `DISCORD_COLLECTIBLES_CHANNEL_ID`
- `DISCORD_QUESTS_CHANNEL_ID`
- `DISCORD_MENTION_COLLECTIBLES`
- `DISCORD_MENTION_QUESTS`

`DISCORD_THREAD_AUTO_ARCHIVE_DURATION` and `DISCORD_QUESTS_BUTTON_URL` are hardcoded in the workflow and do not need to be set as secrets.

### Example secret values

- `DISCORD_BOT_TOKEN`: your Discord bot token
- `DISCORD_COLLECTIBLES_CHANNEL_ID`: channel ID for collectible starter posts
- `DISCORD_QUESTS_CHANNEL_ID`: channel ID for quest posts
- `DISCORD_MENTION_COLLECTIBLES`: mention text for collectible posts (role or everyone)
- `DISCORD_MENTION_QUESTS`: mention text for quest posts

### Workflow behavior

The GitHub Actions workflow will:

1. checkout the repository
2. install dependencies using Bun or npm
3. run the bot via `bun run src/app.ts`
4. commit changes to `state.json` if new items were posted

The workflow no longer reads `.env` in CI, so local `.env` values are not used during GitHub execution.

## Notes

- `src/config/env.ts` loads environment variables from `process.env` or `Bun.env`
- The action uses GitHub Secrets only, so make sure your repository secrets are set correctly
- `state.json` is committed automatically when the workflow detects new state changes
