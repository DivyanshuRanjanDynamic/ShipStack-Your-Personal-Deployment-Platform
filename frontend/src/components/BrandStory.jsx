import React from 'react';
import { Shield, Sparkles, Terminal, Code2, Users, HeartHandshake, CheckCircle2 } from 'lucide-react';

export default function BrandStory() {
  return (
    <section className="brand-story-section" aria-label="About ShipStack & Brand Story">
      <div className="container">
        
        <div className="brand-story-grid">
          
          {/* Left Column: Mission & Origin Story */}
          <div className="story-text-column">
            <span className="badge badge-ai mb-3">
              <Sparkles size={13} />
              <span>Our Mission & Brand Story</span>
            </span>
            <h2 className="story-title">
              We Built ShipStack Because Developers Deserve More Than Cryptic Exit Codes.
            </h2>
            <div className="story-paragraphs">
              <p>
                Every engineer knows the feeling: it’s late in the sprint, you push a critical update to main, and the CI/CD pipeline abruptly terminates with an unhelpful <code>Exit Code 1</code> or an opaque TypeScript error buried deep inside 10,000 lines of terminal logs.
              </p>
              <p>
                We spent years building distributed systems and managing cloud platforms for high-growth tech companies. We realized that while developer tooling had advanced dramatically with modern frameworks like Next.js and Vite, <strong>deployment diagnostics were still stuck in 2012</strong>.
              </p>
              <p>
                <strong>ShipStack was born to change that.</strong> We combined high-performance cloud infrastructure—Apache Kafka, ClickHouse, Docker on AWS ECS, and Amazon S3—with an autonomous intelligence layer. We don’t just host your code; our RAG-powered engine catches build failures the millisecond they occur and gives you the exact, verified solution to fix it.
              </p>
            </div>

            {/* Core Values Pillars */}
            <div className="story-values-row">
              <div className="story-value-item">
                <CheckCircle2 size={16} color="#00dfd8" />
                <span>Zero vendor lock-in</span>
              </div>
              <div className="story-value-item">
                <CheckCircle2 size={16} color="#10b981" />
                <span>Deterministic reproducible builds</span>
              </div>
              <div className="story-value-item">
                <CheckCircle2 size={16} color="#c084fc" />
                <span>Private & secure codebase indexing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Key Team Highlights Card */}
          <div className="story-card-column">
            <div className="story-highlight-card glass-card">
              <div className="card-top-icon">
                <Code2 size={24} color="#0070f3" />
              </div>
              <h3 className="story-card-title">Crafted by Distributed Systems Veterans</h3>
              <p className="story-card-desc">
                Our core engineers have architected streaming backbones and serverless runtimes scaling to tens of billions of requests per month.
              </p>

              <div className="story-metrics-stack">
                <div className="team-metric-box">
                  <span className="metric-big-num">99.99%</span>
                  <span className="metric-big-label">SLA Commitment for Production Clusters</span>
                </div>
                <div className="team-metric-box">
                  <span className="metric-big-num">&lt; 500ms</span>
                  <span className="metric-big-label">Mean Time to AI Diagnostic Diagnosis</span>
                </div>
                <div className="team-metric-box">
                  <span className="metric-big-num">100% Open</span>
                  <span className="metric-big-label">Transparent Service Contracts & Protobuf APIs</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
