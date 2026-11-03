---
name: hackathon-readiness
description: Prepare the project for the Meta Global AI Developer Hackathon submission and judging, including rules compliance, the judging rubric, README, a hackathon-work disclosure, the 3-minute demo, bonus prizes, and making the product work well for users in the Philippines and internationally. Use this whenever the user mentions the hackathon, submission, judges, demo video, rubric, README, deadline, or prizes.
---

# Hackathon readiness

Deadline: **Wed, Nov 4, 9:00 PM ET**, which is **Thu, Nov 5, 10:00 AM Philippine Time**. Late submissions aren't considered. Fix anything that could cause disqualification first.

## 1. Disqualification checks (do first)

- The repository is public, and the README instructions work from a clean clone.
- **New work is clearly identified.** Create `HACKATHON.md` listing what was built from Oct 27 to Nov 4, using `git log --since=2026-10-27`. If the project builds on earlier code, separate "existed before" from "built during the hackathon." Judges can disqualify projects that don't make this clear.
- **Meta models are actually used.** List each Meta model or tool used (Meta Model API models, open-weight models, Muse Code), the file where it's called, and what it does. Stage One judging is pass/fail on this.
- The project fits a problem statement, either "Build for Your World" or "Push the Frontier." Name it in the README.
- The project isn't on the anti-project list: AI medical advice, basic RAG apps, simple image analyzers, simple education chatbots, job application screeners, nutrition coaches, personality analyzers, sports analyzers or coaches, or anything political or about war. If the project is close to one of these, tell the user right away and suggest how to differentiate it.
- The team has rights to all code, data, and assets. Check licenses for datasets, images, and fonts.

## 2. Score against the rubric

Score the project from 0 to 10 in each category with honest reasoning, then list the top 3 improvements that fit in the time left.

- **Impact (30%):** who benefits, how much, and which problem statement it fits. A concrete use case in the Philippines with a clear path to international users tends to be strong.
- **Use of Meta AI tooling (25%):** go beyond one basic API call. Multimodal input, SAM 3.1, voice transcription, or open-weight models on partner inference show depth.
- **Technical depth and execution (20%):** error handling, tests, verification, and security. The fact-check, anomaly-sweep, and live-security-hardening skills feed this category.
- **Demo (25%):** working, live, and good to watch.

## 3. README

Include a one-line pitch, the problem and who it's for, a screenshot or GIF, the live link, which Meta models are used and how, an architecture diagram, setup steps, a link to `HACKATHON.md`, team members, and known limitations.

## 4. Three-minute demo script

Write `reports/demo-script.md`, timed to under 3:00:

- **0:00–0:20:** the problem, shown through a real user in the Philippines
- **0:20–2:15:** the live product doing its main task, showing only features built during the hackathon and naming the Meta models on screen
- **2:15–2:45:** what makes it technically interesting, such as the verification layer, the agent workflow, or open-weight serving
- **2:45–3:00:** impact and what's next

Make sure the demo path needs no login or setup, and has a fallback if the model is slow.

## 5. Users in the Philippines and internationally

- Use English by default. Consider supporting Filipino and Taglish input, and a Filipino UI toggle if it's cheap to add.
- Show money and time clearly for both audiences, for example "₱1,500 (~US$26)" and times with their time zone.
- Make pages load fast on mobile data: compress images, lazy-load content, and avoid large bundles.
- Check accessibility: readable contrast, alt text, and keyboard navigation.

## 6. Bonus prizes

Check which of these the project qualifies for and tell the user:

- **Most Viral:** post the demo on X and submit the link.
- **Best Build on Meta Open Weight Models:** uses Muse Glimmer or Muse Spark Open on the team's own hardware or partner inference.
- **Community Vote:** the most votes in the public gallery.
- **Best Agentic Use-Case:** strong use of AI agents for multi-step tasks.
- **Best Creative Build:** uses Muse Image or Muse Wonder.

## Output

Write `reports/readiness.md` with a pass/fail checklist for section 1, the rubric scores, the top 3 improvements, and the bonus prizes that fit. Create or update `README.md` and `HACKATHON.md` directly.
