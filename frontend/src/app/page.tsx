import Link from "next/link";

const pillars = [
  {
    number: "01",
    title: "See the signal",
    text: "Bring together river gauges, rainfall, weather, and community observations without losing their provenance.",
  },
  {
    number: "02",
    title: "Predict the shift",
    text: "A local forecasting pipeline turns noisy readings into an uncertainty-aware view of what comes next.",
  },
  {
    number: "03",
    title: "Move sooner",
    text: "Risk is translated into a clear brief so people can act before a warning becomes an emergency.",
  },
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <Link className="brand" href="/">
          <span className="brand-mark">H</span>
          <span>Hydro<span>Sentinel</span></span>
        </Link>
        <div className="nav-links">
          <a href="#why">Why it matters</a>
          <a href="#how">How it works</a>
          <Link className="nav-cta" href="/featured">Open command center <span>↗</span></Link>
        </div>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" /> EARLY WARNING, REIMAGINED</div>
          <h1>Give communities<br /><em>more time.</em></h1>
          <p className="hero-lede">
            HydroSentinel turns fragmented water data into an explainable flood
            outlook — so the people closest to the risk can make their next
            decision with confidence.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/featured">Explore live forecast <span>→</span></Link>
            <a className="text-link" href="#why">See the thinking <span>↓</span></a>
          </div>
          <div className="hero-note">
            <span className="meta-spark">✦</span>
            Built with Meta Model API · Muse Spark · SAM 3.1 · Muse Image
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustration of a river monitoring network">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="river-line" />
          <div className="terrain terrain-a" />
          <div className="terrain terrain-b" />
          <div className="map-label label-top">NORTH BASIN <span>●</span></div>
          <div className="map-label label-bottom">SOUTH FORK <span>●</span></div>
          <div className="station-card">
            <div className="station-head"><span className="status-live" /> LIVE STATION <span className="station-time">09:42:18</span></div>
            <strong>Riverside North</strong>
            <div className="station-level"><span>2.84</span> m <b>↑ 0.18m</b></div>
            <div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="station-foot"><span>Forecast in 6h</span><strong>3.21m</strong></div>
          </div>
          <div className="signal signal-one"><span /></div>
          <div className="signal signal-two"><span /></div>
          <div className="visual-caption">ONE NETWORK. A CLEARER NEXT MOVE.</div>
        </div>
      </section>

      <section className="trust-bar">
        <div className="shell trust-inner">
          <span>FROM RAW READINGS</span><i>→</i><span>TO SHARED UNDERSTANDING</span>
          <div className="trust-rule" />
          <span className="trust-meta"><span className="meta-spark">✦</span> Designed for the last mile</span>
        </div>
      </section>

      <section className="section shell" id="why">
        <div className="section-kicker">THE CASE FOR CLARITY</div>
        <div className="split-heading">
          <h2>When the water<br /><em>moves,</em> context matters.</h2>
          <p>Flood response is not a single-model problem. It is a handoff problem: from a sensor to a forecaster, from a forecast to a family, from uncertainty to a decision.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar" key={pillar.number}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="pillar-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-band" id="how">
        <div className="shell feature-inner">
          <div>
            <div className="section-kicker light">THE HYDROSENTINEL LOOP</div>
            <h2>Intelligence that<br /><em>earns trust.</em></h2>
            <p>Every alert keeps a trail: the data, the model, the uncertainty, and the reason it matters now.</p>
            <Link className="button button-light" href="/featured">See the command center <span>→</span></Link>
          </div>
          <div className="loop-diagram">
            <div className="loop-node node-a"><span>01</span> Observe</div>
            <div className="loop-node node-b"><span>02</span> Forecast</div>
            <div className="loop-node node-c"><span>03</span> Explain</div>
            <div className="loop-node node-d"><span>04</span> Act</div>
            <div className="loop-core">H<span>↗</span></div>
            <div className="loop-arc arc-a" /><div className="loop-arc arc-b" />
          </div>
        </div>
      </section>

      <section className="closing shell">
        <div className="closing-mark">H</div>
        <div>
          <div className="section-kicker">THE FIRST STEP IS SEEING IT</div>
          <h2>Let&apos;s make the<br /><em>next hour count.</em></h2>
        </div>
        <Link className="button button-primary" href="/featured">Enter HydroSentinel <span>↗</span></Link>
      </section>

      <footer className="footer shell">
        <span>HydroSentinel / 2026</span>
        <span>Built for a safer tomorrow.</span>
        <span>Meta AI Developer Hackathon</span>
      </footer>
    </main>
  );
}
