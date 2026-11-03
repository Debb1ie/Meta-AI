---
name: fact-check
description: Verify factual claims in the product and stop the live app from showing users wrong information. Use this whenever the user mentions fact-checking, accuracy, hallucinations, wrong answers, grounding, citations, or trust, and before any demo or submission. Covers two layers, static claims in the codebase (UI copy, README, prompts, seed data, demo script) and runtime claims the AI model generates for users.
---

# Fact-check

Goal: nothing the product says to a judge or user should be false, unsupported, or stale. Work in two passes and report before changing behavior.

## Pass 1: Static claims in the repo

1. Find every user-facing claim. Search UI strings, README, landing copy, system prompts, seed or sample data, demo scripts, and any `.md` or `.json` content the app displays.
2. List each claim that states a fact: numbers, prices, dates, laws, agencies, statistics, model names, capabilities, and comparisons.
3. Give each claim one of these statuses:
   - VERIFIED: you confirmed it from a primary source (official docs, government site, or the code itself). Note the source.
   - UNSUPPORTED: no source found. Soften the wording, cite a source, or remove the claim.
   - WRONG: contradicts a source. Fix it.
   - STALE: was true once but may have changed (prices, exchange rates, policies, model names). Add an "as of" date or load the value from config.
4. Check claims about Meta models especially carefully. Every model the README or demo says is used (Muse Spark, Muse Wonder, Muse Image, Muse Voice Transcribe, SAM 3.1, Muse Glimmer, Muse Spark Open, Muse Code) must actually be called in the code. Judges check this in Stage One.
5. For the Philippines, check peso amounts (₱, PHP), government agency names and acronyms, Philippine Time (UTC+8), and laws cited by number (for example, RA 10173, the Data Privacy Act). For international users, check that currency and time are also readable to someone outside the Philippines.

## Pass 2: Runtime claims the model generates

Check how the app handles model output before it reaches a user. Propose the smallest changes that add these protections:

- **Grounding.** When the app answers factual questions, answers should come from retrieved or provided sources, and the app should show those sources. If no source is available, the app says so instead of guessing.
- **Structured output.** When model output feeds the UI or other code, validate it against a schema (Zod, Pydantic, or similar). Reject or retry invalid output instead of rendering it.
- **Uncertainty.** The system prompt tells the model to say when it isn't sure, and never to invent numbers, names, URLs, or citations.
- **Verification for high-stakes outputs.** Add a second, cheap model call or a rule check that compares the answer against its sources and flags unsupported sentences.
- **Links.** Any link the model produces must come from an allowlist or be validated before display. Never present a model-invented link as trusted.
- **Regulated domains.** The hackathon rules ban projects that use AI to give medical advice. If any output could read as medical, legal, or financial advice, flag it to the user immediately.

## Output

Write `reports/fact-check.md` with a table of claim, location (file:line), status, source, and fix. Then list proposed runtime changes, ranked by impact versus effort. Apply text fixes directly. Ask before changing prompts or app logic, because those change how the demo behaves.
