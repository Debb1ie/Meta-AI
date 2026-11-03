import Link from "next/link";
import { Icon } from "./featured/shared";
import { GridLive, HeroLive, MetaModelsLive, RightNowLive } from "./landing";

const REPO = "https://github.com/Debb1ie/Meta-AI";

const pillars = [
  {
    number: "01",
    title: "See the signal",
    text: "Live river gauges, a 17-basin Philippine outlook, rainfall and typhoon feeds, each with its source.",
  },
  {
    number: "02",
    title: "Predict the shift",
    text: "A backtested forecasting engine turns noisy readings into a view of what comes next, with honest uncertainty.",
  },
  {
    number: "03",
    title: "Move sooner",
    text: "A Muse Spark agent writes a cited, verified briefing and SMS alerts in five Philippine languages.",
  },
];

const people = [
  {
    icon: Icon.shield,
    title: "Barangay and municipal DRRM offices",
    text: "A plain-language briefing on which rivers are rising, how close each is to its watch level and what to do next, with an SMS ready to forward in the language residents speak.",
  },
  {
    icon: Icon.outlook,
    title: "Provincial and LGU planners",
    text: "A 30-day flow outlook for 17 major basins, from the Cagayan in the north to the Mindanao River in the south, with alert levels based on each river's own five-year record.",
  },
  {
    icon: Icon.ask,
    title: "Families in flood-prone areas",
    text: "Short, calm messages in Filipino, Cebuano, Ilocano, Hiligaynon or English, that always point to PAGASA and local authorities for official warnings.",
  },
];

const trust = [
  {
    title: "Every number is checked",
    text: "The agent must cite the tool result behind each claim. Our server compares every number against that source and flags any that don't match, before the briefing is shown.",
  },
  {
    title: "Forecasts are tested first",
    text: "Three models compete for each forecast horizon and are scored on data they never saw, against a simple no-change baseline. The dashboard shows the scores.",
  },
  {
    title: "Open data with a trail",
    text: "GloFAS river flow via Open-Meteo, GDACS disaster alerts, UK Environment Agency gauges and Open-Meteo rainfall. Every reading keeps its source and exports to CSV.",
  },
  {
    title: "Secure by default",
    text: "Model keys never reach the browser. Changing alert levels needs an admin key, AI features are rate-limited, and every page sends strict security headers.",
  },
];

const steps = [
  { n: "1", title: "Watch the agent investigate", text: "Open the Agent tab and follow each tool call, then tap any citation to see the exact data behind it.", href: "/featured?tab=agent", cta: "Open the agent" },
  { n: "2", title: "Check any Philippine river", text: "Pick a basin on the map to see its 30-day flow, its alert levels and today's status.", href: "/featured?tab=outlook", cta: "Open the outlook" },
  { n: "3", title: "Test the data checker", text: "Download our demo file, a synthetic typhoon at a Marikina gauge with real-world gaps, and run it through the validator.", href: "/featured?tab=tools#tool-import", cta: "Open the checker", download: "/samples/demo-scenario-marikina-typhoon-synthetic.csv" },
  { n: "4", title: "Ask in your language", text: "Try a question in English or Filipino, such as “Ligtas ba ang Ilog Cagayan ngayong linggo?”", href: "/featured?tab=ask", cta: "Ask Muse Spark" },
];

const loop = [
  { n: "01", label: "Observe", icon: Icon.stations },
  { n: "02", label: "Forecast", icon: Icon.activity },
  { n: "03", label: "Verify", icon: Icon.shield },
  { n: "04", label: "Alert", icon: Icon.ask },
];

const JUMP = [
  { label: "Agent", href: "/featured?tab=agent", icon: Icon.agent },
  { label: "PH Outlook", href: "/featured?tab=outlook", icon: Icon.outlook },
  { label: "Live gauges", href: "/featured?tab=stations", icon: Icon.stations },
  { label: "Ask", href: "/featured?tab=ask", icon: Icon.ask },
  { label: "Photo check", href: "/featured?tab=tools#tool-photo", icon: Icon.image },
  { label: "Posters", href: "/featured?tab=tools#tool-poster", icon: Icon.bag },
  { label: "3D forecast", href: "/research", icon: Icon.map },
];

export default function Home() {
  return (
    <main className="lp">
      <nav className="nav shell">
        <Link className="brand" href="/">
          <span className="brand-mark">H</span>
          <span>Hydro<span>Sentinel</span></span>
        </Link>
        <div className="nav-links">
          <a href="#impact">Who it helps</a>
          <a href="#meta">Meta AI</a>
          <a href="#try">Try it</a>
          <Link href="/research">Research</Link>
          <Link className="nav-cta" href="/featured" aria-label="Open command center">
            <span className="nav-cta-long">Open command center</span><span className="nav-cta-short">Open app</span> {Icon.arrow}
          </Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" /> Flood early warning for the Philippines</div>
          <h1>Give communities<br /><em>more time.</em></h1>
          <p className="hero-lede">
            HydroSentinel watches Philippine rivers, typhoons and rainfall around the clock. A Muse Spark agent turns the
            live data into a verified briefing and alerts people can read in their own language.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/featured">Explore the live dashboard {Icon.arrow}</Link>
            <a className="text-link" href="#try">Try it yourself {Icon.down}</a>
          </div>
          <nav className="lp-jump" aria-label="Jump straight to a feature">
            <span>Jump straight in</span>
            {JUMP.map((j) => <Link key={j.label} href={j.href}>{j.icon}{j.label}</Link>)}
          </nav>
          <div className="hero-note">
            <span className="meta-spark">{Icon.spark}</span>
            Built with Meta&apos;s Muse Spark, SAM 3.1 and Muse Image through the Meta Model API
          </div>
        </div>
        <HeroLive />
      </section>

      <RightNowLive />

      <section className="section shell" id="why">
        <div className="section-kicker">Why it matters</div>
        <div className="split-heading">
          <h2>When the water<br /><em>moves,</em> context matters.</h2>
          <p>
            An average of 20 tropical cyclones enter the Philippine Area of Responsibility each year, according to{" "}
            <a href="https://www.pagasa.dost.gov.ph/climate/tropical-cyclone-information" target="_blank" rel="noreferrer">PAGASA</a>.
            Flood response is a handoff problem: from a sensor to a forecast, from a forecast to a family, from
            uncertainty to a decision.
          </p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar" key={pillar.number}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="pillar-arrow">{Icon.arrow}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="lx-section lx-tint" id="impact">
        <div className="shell">
          <div className="section-kicker">Who it helps</div>
          <h2 className="lx-h2">Built for the people <em>closest to the river.</em></h2>
          <div className="lx-people">
            {people.map((p) => (
              <article key={p.title} className="lx-person">
                <span className="lx-tile-icon">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lx-section" id="meta">
        <div className="shell">
          <div className="section-kicker">Meta AI inside</div>
          <h2 className="lx-h2">Four jobs, <em>three Meta models.</em></h2>
          <p className="lx-lede">Each model does work a person would otherwise have to do by hand, and each result is labelled and checkable.</p>
          <MetaModelsLive />
        </div>
      </section>

      <section className="lx-section lx-tint" id="inside">
        <div className="shell">
          <div className="section-kicker">What you get</div>
          <h2 className="lx-h2">Everything runs <em>on live data.</em></h2>
          <GridLive />
        </div>
      </section>

      <section className="lx-section" id="trust">
        <div className="shell">
          <div className="section-kicker">Built to be trusted</div>
          <h2 className="lx-h2">A warning is only useful <em>if people believe it.</em></h2>
          <div className="lx-trust">
            {trust.map((t) => (
              <article key={t.title}>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </article>
            ))}
          </div>
          <p className="lx-links">
            <a href={REPO} target="_blank" rel="noreferrer">Read the code on GitHub</a>
            <a href={`${REPO}/tree/main/reports`} target="_blank" rel="noreferrer">Security and quality reports</a>
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </section>

      <section className="feature-band" id="how">
        <div className="shell feature-inner">
          <div>
            <div className="section-kicker light">How it works</div>
            <h2>Intelligence that<br /><em>earns trust.</em></h2>
            <p>Every alert keeps a trail: the data, the model, the uncertainty, the evidence it cites, and the reason it matters now.</p>
            <Link className="button button-light" href="/featured?tab=agent">Watch the agent work {Icon.arrow}</Link>
          </div>
          <div className="orb-scene" role="img" aria-label="The HydroSentinel loop: observe, forecast, verify, alert">
            <svg className="orb-path" viewBox="0 0 400 400" aria-hidden><circle cx="200" cy="200" r="175" /></svg>
            <div className="orb-glow" aria-hidden />
            <div className="orb-halo" aria-hidden />
            <div className="orb-shadow" aria-hidden />
            <div className="orb-space" aria-hidden>
              <i className="orb-ring r1"><b /></i>
              <i className="orb-ring r2"><b /></i>
              <i className="orb-ring r3"><b /></i>
              <div className="orb">
                <div className="orb-water"><i /><i /></div>
                <span className="orb-h">H</span>
                <span className="orb-shine" />
              </div>
            </div>
            {loop.map((node, i) => (
              <div key={node.n} className={`orb-node n${i}`} style={{ "--k": i } as React.CSSProperties}>
                <span>{node.icon}</span>
                <b>{node.n}</b>
                {node.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lx-section" id="try">
        <div className="shell">
          <div className="section-kicker">Try it yourself</div>
          <h2 className="lx-h2">Four things to try <em>in five minutes.</em></h2>
          <ol className="lx-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="lx-step-n" aria-hidden>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <div className="lx-step-actions">
                  <Link href={s.href}>{s.cta}{Icon.arrow}</Link>
                  {s.download && <a href={s.download} download>{Icon.download}Demo CSV</a>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="closing shell">
        <div className="closing-mark">H</div>
        <div>
          <div className="section-kicker">Ready when the next storm is</div>
          <h2>Let&apos;s make the<br /><em>next hour count.</em></h2>
        </div>
        <Link className="button button-primary" href="/featured">Enter HydroSentinel {Icon.arrow}</Link>
      </section>

      <footer className="footer shell lx-footer">
        <span>HydroSentinel, built for the Meta Global AI Developer Hackathon 2026</span>
        <span>
          Data: GloFAS via Open-Meteo (CC BY 4.0), GDACS, UK Environment Agency (OGL v3), Open-Meteo. Map outline: Natural Earth.
        </span>
        <span className="lx-footer-links">
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/featured">Dashboard</Link>
        </span>
      </footer>
    </main>
  );
}
