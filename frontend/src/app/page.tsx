import Link from "next/link";
import { Icon } from "./featured/shared";
import { GridLive, HeroLive, RevealOnScroll, TickerLive } from "./landing";

const pillars = [
  {
    number: "01",
    title: "See the signal",
    text: "Live river gauges, a 17-basin Philippine outlook, rainfall and typhoon feeds, each with its provenance.",
  },
  {
    number: "02",
    title: "Predict the shift",
    text: "A backtested forecasting engine turns noisy readings into an uncertainty-aware view of what comes next.",
  },
  {
    number: "03",
    title: "Move sooner",
    text: "A Muse Spark agent writes a cited, verified briefing and SMS alerts in five Philippine languages.",
  },
];

const loop = [
  { n: "01", label: "Observe", icon: Icon.stations },
  { n: "02", label: "Forecast", icon: Icon.activity },
  { n: "03", label: "Verify", icon: Icon.shield },
  { n: "04", label: "Alert", icon: Icon.ask },
];

export default function Home() {
  return (
    <main className="lp">
      <RevealOnScroll />
      <nav className="nav shell">
        <Link className="brand" href="/">
          <span className="brand-mark">H</span>
          <span>Hydro<span>Sentinel</span></span>
        </Link>
        <div className="nav-links">
          <a href="#why">Why it matters</a>
          <a href="#inside">What&apos;s inside</a>
          <a href="#how">How it works</a>
          <Link className="nav-cta" href="/featured">Open command center {Icon.arrow}</Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow lp-rise"><span className="pulse-dot" /> EARLY WARNING, REIMAGINED</div>
          <h1 className="lp-rise" style={{ animationDelay: "80ms" }}>Give communities<br /><em>more time.</em></h1>
          <p className="hero-lede lp-rise" style={{ animationDelay: "160ms" }}>
            HydroSentinel watches Philippine rivers, typhoons and rainfall around the clock. A Muse Spark agent turns the
            live data into a verified briefing and alerts people can read in their own language.
          </p>
          <div className="hero-actions lp-rise" style={{ animationDelay: "240ms" }}>
            <Link className="button button-primary" href="/featured">Explore the live dashboard {Icon.arrow}</Link>
            <a className="text-link" href="#inside">See what&apos;s inside {Icon.down}</a>
          </div>
          <div className="hero-note lp-rise" style={{ animationDelay: "320ms" }}>
            <span className="meta-spark">{Icon.spark}</span>
            Built with Meta Model API · Muse Spark · SAM 3.1 · Muse Image
          </div>
        </div>
        <HeroLive />
      </section>

      <TickerLive />

      <section className="section shell" id="why">
        <div className="section-kicker" data-reveal>THE CASE FOR CLARITY</div>
        <div className="split-heading" data-reveal>
          <h2>When the water<br /><em>moves,</em> context matters.</h2>
          <p>Flood response is not a single-model problem. It is a handoff problem: from a sensor to a forecaster, from a forecast to a family, from uncertainty to a decision.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar, i) => (
            <article className="pillar" key={pillar.number} data-reveal style={{ transitionDelay: `${i * 120}ms` }}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="pillar-arrow">{Icon.arrow}</span>
            </article>
          ))}
        </div>
      </section>

      <GridLive />

      <section className="feature-band" id="how">
        <div className="shell feature-inner">
          <div data-reveal>
            <div className="section-kicker light">THE HYDROSENTINEL LOOP</div>
            <h2>Intelligence that<br /><em>earns trust.</em></h2>
            <p>Every alert keeps a trail: the data, the model, the uncertainty, the evidence it cites, and the reason it matters now.</p>
            <Link className="button button-light" href="/featured?tab=agent">Watch the agent work {Icon.arrow}</Link>
          </div>
          <div className="orb-scene" data-reveal role="img" aria-label="The HydroSentinel loop: observe, forecast, verify, alert">
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

      <section className="closing shell" data-reveal>
        <div className="closing-mark">H</div>
        <div>
          <div className="section-kicker">THE FIRST STEP IS SEEING IT</div>
          <h2>Let&apos;s make the<br /><em>next hour count.</em></h2>
        </div>
        <Link className="button button-primary" href="/featured">Enter HydroSentinel {Icon.arrow}</Link>
      </section>

      <footer className="footer shell">
        <span>HydroSentinel / 2026</span>
        <span>Data: GloFAS via Open-Meteo, GDACS, Environment Agency</span>
        <span>Meta Global AI Developer Hackathon</span>
      </footer>
    </main>
  );
}
