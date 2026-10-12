import React from 'react';
import { Star, Quote, CheckCircle2, Building, TrendingUp } from 'lucide-react';

export default function Testimonials() {
  const reviews = [
    {
      id: 1,
      quote: "ShipStack caught a subtle Vite SSR hydration mismatch during our Friday night product launch that would have taken our on-call team 4 hours to diagnose. The 1-click RAG patch fixed it in under 60 seconds.",
      author: "Alex Rivera",
      role: "VP of Engineering",
      company: "Synthetix Labs",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      metric: "82% faster build incident recovery"
    },
    {
      id: 2,
      quote: "The Kafka log streaming is blisteringly fast compared to other platforms. Seeing live terminal output with zero latency and having an autonomous AI point directly to the broken package line is pure developer magic.",
      author: "Kavita Rao",
      role: "Staff Platform Architect",
      company: "HyperScale Cloud",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      metric: "12,000+ deployments managed monthly"
    },
    {
      id: 3,
      quote: "We migrated 45 repositories from traditional CI/CD to ShipStack. Our junior developers are no longer blocked by obscure Docker or Node version mismatch errors—the RAG system teaches them the fix as they ship.",
      author: "Marcus Vance",
      role: "CTO & Co-Founder",
      company: "Prism Dynamics",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      metric: "Zero CI/CD support tickets this month"
    }
  ];

  return (
    <section className="testimonials-section" aria-label="Customer Reviews and Case Studies">
      <div className="container">
        
        {/* Section Header */}
        <div className="section-head text-center">
          <span className="badge badge-green mb-3">
            <CheckCircle2 size={13} />
            <span>Trusted By Engineering Teams Worldwide</span>
          </span>
          <h2 className="section-title">
            Loved by Developers.{' '}
            <span className="gradient-text">Validated in Production.</span>
          </h2>
          <p className="section-subtitle">
            Here is how leading engineering teams use ShipStack to ship faster and eliminate build-failure downtime.
          </p>
        </div>

        {/* 3-Column Reviews Grid */}
        <div className="testimonials-grid">
          {reviews.map((r) => (
            <div key={r.id} className="testimonial-card glass-card">
              <div className="card-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#fbbf24" color="#fbbf24" />
                ))}
              </div>

              <p className="testimonial-quote">"{r.quote}"</p>

              <div className="testimonial-metric-pill">
                <TrendingUp size={13} color="#00dfd8" />
                <span>{r.metric}</span>
              </div>

              <div className="testimonial-author-row">
                <img 
                  src={r.avatar} 
                  alt={r.author} 
                  className="author-avatar"
                  loading="lazy"
                />
                <div className="author-meta">
                  <div className="author-name">{r.author}</div>
                  <div className="author-role">{r.role} • {r.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Macro Case Study Callout Banner */}
        <div className="case-study-banner glass-card mt-6">
          <div className="case-study-left">
            <span className="case-study-pill">Case Study Highlight</span>
            <h3>How Acme Global Scaled 1,400 Micro-frontends on ShipStack</h3>
            <p>Read how a Tier-1 retail platform reduced deployment latency by 68% and eliminated 94% of manual build debugging using ShipStack's RAG diagnosis.</p>
          </div>
          <div className="case-study-stat">
            <span className="stat-number">99.99%</span>
            <span className="stat-desc">Production Availability across 32 Edge Regions</span>
          </div>
        </div>

      </div>
    </section>
  );
}
