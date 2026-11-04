# Demo script (3 minutes)

Presenter: Precious Grace Deborah Manucom
Target length: 2:55
Live site: https://hydrosentinel-plum.vercel.app (no login needed)

## Before you record

1. Ten minutes before, open https://hydrosentinel-ph-api.onrender.com/api/ai/status so the free backend is awake.
2. Open the Agent tab and press Run once, so a fresh briefing is cached. If the live run is slow during recording, the cached briefing appears straight away. That is the fallback.
3. Have a flood photo ready on the desktop for the photo check (a street with standing water works well).
4. Open these tabs in order: the landing page, `/featured?tab=agent`, `/featured?tab=outlook`, `/featured?tab=ask`, `/featured?tab=tools`, `/research`.
5. Set the browser zoom to 110% so text is readable in the video. Turn off notifications.

## Script

### 0:00 to 0:20: the problem

**On screen:** the landing page hero, then scroll to "Why it matters".

**Say:**
"In the Philippines, about 20 tropical cyclones enter our area of responsibility every year. When a river starts rising, a barangay disaster officer has minutes to decide: do we tell families to move? The data exists, but it's scattered across feeds, in units nobody reads at 2 AM. HydroSentinel turns it into a clear briefing, in the language people speak."

### 0:20 to 1:05: the agent at work (Muse Spark)

**On screen:** the Agent tab. Press Run. Let the trace stream in.

**Say:**
"This is a Muse Spark agent from Meta's Model API. It isn't following a script. It decides which of six tools to call: typhoon and flood alerts from GDACS, all 17 Philippine river basins, one basin in detail, the rain forecast, and live gauges. Every step is logged as evidence."

**Then:** tap one citation in the briefing so the source data opens.

**Say:**
"Every claim cites the exact tool result behind it. And here's the part I care most about: our server, not the model, checks every number against its source. Here it shows how many numbers it checked, and every one is verified."

### 1:05 to 1:25: alerts in local languages

**On screen:** scroll to the SMS block and switch between Filipino, Cebuano, Ilocano and Hiligaynon.

**Say:**
"The same agent writes SMS alerts in five languages, ready to forward. Each one says it's model guidance and points people to PAGASA and their local DRRM office for official warnings."

### 1:25 to 1:45: the national picture

**On screen:** the PH Outlook tab. Tap a basin on the map, for example the Cagayan.

**Say:**
"Here are all 17 basins, from the Cagayan in the north to the Mindanao River in the south. Each river has alert levels based on its own five-year record, and a 30-day flow outlook."

### 1:45 to 2:00: ask in Filipino (Muse Spark)

**On screen:** the Ask tab. Type: "Ligtas ba ang Ilog Cagayan ngayong linggo?"

**Say:**
"Anyone can ask in English, Filipino or Taglish. The answer comes back in Filipino, grounded in the same data."

### 2:00 to 2:15: photo check and posters (SAM 3.1 and Muse Image)

**On screen:** the Tools tab. Upload the flood photo, then show a generated poster.

**Say:**
"SAM 3.1 measures how much of a field photo is underwater, and the photo is never stored. Muse Image makes a community poster matched to today's alert level."

### 2:15 to 2:45: what's technically interesting

**On screen:** the Research page. Drag the day slider so the 3D columns rise and fall, then scroll to the heat map and the evaluation table.

**Say:**
"Under the hood, three forecasting models compete for every horizon, a no-change baseline, a damped trend and gradient boosting, and they're scored on data they've never seen, with calibrated uncertainty ranges. This 3D layer shows 30 days of flow across the country against each river's watch level. Everything here is live, open data, and the methods are documented on this page."

### 2:45 to 3:00: impact and what's next

**On screen:** back to the landing page, "Who it helps".

**Say:**
"HydroSentinel is built for barangay officers, LGU planners and families who live near rivers. Next, we want to pilot it with a local DRRM office and add measured Philippine gauges as they open up. Give communities more time. Thank you."

## If something goes wrong

| Problem | What to do |
|---|---|
| The agent run is slow | Say "the agent is still investigating; here is the briefing it wrote a few minutes ago" and show the cached briefing. |
| Ask returns a rate-limit message | Wait about a minute, or skip to the photo check. The limit is 6 questions a minute per person. |
| The backend is asleep | The page shows the last cached data. Keep talking over the Research page while it wakes up. |
| A poster takes too long | Move on to the Research page and come back at the end if time allows. |

## Meta models named on screen

- Muse Spark: the agent (0:20) and Ask (1:45)
- SAM 3.1: the photo check (2:00)
- Muse Image: posters (2:00)
