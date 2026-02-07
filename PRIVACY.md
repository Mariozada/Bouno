# Privacy Policy

**Last updated:** February 8, 2026

## Overview

Bouno is a browser automation Chrome extension. It operates entirely within your browser and does not have a backend server. No data is collected, stored, or transmitted by the developer.

## Data That Stays on Your Device

- **Conversations** — stored locally in your browser's IndexedDB. Never sent to any server owned by the developer.
- **API keys** — stored locally in Chrome's extension storage. Used only to authenticate directly with your chosen AI provider.
- **Settings and preferences** — stored locally in Chrome's extension storage.
- **File attachments** — screenshots and uploaded images are stored locally in IndexedDB.

## Data Sent to Third Parties

When you use Bouno, the following data is sent **directly from your browser** to the AI provider you configure (e.g., Anthropic, OpenAI, Google, Groq, OpenRouter, or a local model):

- Your messages and instructions
- Page content (accessibility tree, text) when you ask Bouno to read a page
- Screenshots when you ask Bouno to take one

This data is sent using **your own API key** and is subject to the privacy policy of the AI provider you choose. Bouno does not route, intercept, or store this data on any intermediary server.

## Data We Do NOT Collect

- No analytics or telemetry
- No tracking or fingerprinting
- No personal information
- No browsing history
- No cookies

## Local Models

If you use a local AI provider (such as Ollama or LM Studio), no data leaves your device at all.

## Data Deletion

All data is stored locally in your browser. You can delete everything at any time through:
- The extension's settings (Data tab → Delete All Data)
- Uninstalling the extension
- Clearing browser data for the extension

## Contact

If you have questions about this privacy policy, please open an issue at: https://github.com/Mariozada/Bouno/issues
