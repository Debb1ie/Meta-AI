---
name: anomaly-sweep
description: Find and remove anomalies that make a product look unfinished or behave unpredictably, such as inconsistent values, naming mismatches, dead links, typos, stale dates, broken edge cases, console errors, and odd states. Use this whenever the user mentions polish, bugs, QA, anomalies, inconsistencies, edge cases, cleanup, or getting ready for judges or users, even if they don't use the word anomaly.
---

# Anomaly sweep

Goal: the product is consistent everywhere and behaves sensibly with real-world input from users in the Philippines and abroad.

## 1. Consistency

- The same thing has the same name, number, and spelling everywhere: UI, README, prompts, API responses, and the demo script. Grep for variants of the product name, model names, prices, and other key terms.
- No placeholder text remains. Search for `lorem`, `TODO`, `FIXME`, `xxx`, `test@`, `example.com`, "Link" used as link text, and empty `href` values.
- Dates and years are current. Search for hard-coded years and "coming soon" copy.
- Links work. Collect every URL in the repo and UI, check that each returns a 2xx response, and report the ones that don't.

## 2. Edge-case inputs

Test the main flows with these inputs and record what breaks:

- Empty input, a single character, and very long input (10,000+ characters)
- Filipino and Taglish text, names with ñ and accents, emoji, and right-to-left text
- Mixed currencies (₱1,500, PHP 1500, $25) and both date orders (11/03/2026 and 03/11/2026)
- A slow network, a model call that times out, and a model call that returns an error or malformed output
- Double-clicking submit, refreshing mid-request, and pressing back
- A 360px mobile screen, since many users in the Philippines are on phones and mobile data

## 3. Runtime health

- Run the app and check the browser console and server logs for errors and warnings.
- Every loading state shows a spinner or message. Every error state shows a readable message, not a stack trace or a blank screen.
- Remove debug logging that prints prompts, tokens, keys, or user data.
- Run the linter, type checker, and tests. Fix what fails, or report it if the fix is risky.

## 4. Data anomalies

If the app stores or displays data, look for duplicates, missing values, outliers (negative prices, dates in 1970 or 2099), and mismatched units. Fix seed data directly. For live data, report the problem and propose a validation rule instead of editing records.

## Output

Write `reports/anomalies.md` grouped into **Fixed**, **Needs decision**, and **Known limitation**. Fix low-risk items (typos, dead links, placeholder text, error messages) directly, in small commits with clear messages. Ask before changing behavior in the main demo flow.
