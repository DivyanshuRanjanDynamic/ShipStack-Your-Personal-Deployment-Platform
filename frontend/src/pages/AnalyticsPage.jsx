import React from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  ChevronDown,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Radio
} from 'lucide-react';

export default function AnalyticsPage() {
  const pagesList = [
    { path: '/', views: 42 },
    { path: '/blog/CNC_Machining_Cost_in_India_2026', views: 21 },
    { path: '/login', views: 12 },
    { path: '/shop', views: 8 },
    { path: '/about', views: 7 },
    { path: '/contact', views: 5 },
    { path: '/onboard', views: 5 }
  ];

  const referrersList = [
    { name: 'google.com', count: 25 },
    { name: 'bing.com', count: 3 },
    { name: 'com.google.android.gm', count: 2 },
    { name: 'duckduckgo.com', count: 2 },
    { name: 'chatgpt.com', count: 1 },
    { name: 'in.search.yahoo.com', count: 1 },
    { name: 'search.brave.com', count: 1 }
  ];

  const countriesList = [
    { flag: '🇮🇳', name: 'India', share: '62%' },
    { flag: '🇨🇳', name: 'People\'s Republic of China', share: '16%' },
    { flag: '🇺🇸', name: 'United States of America', share: '12%' },
    { flag: '🇳🇱', name: 'Netherlands', share: '3%' },
    { flag: '🇦🇪', name: 'United Arab Emirates', share: '1%' }
  ];

  return (
    <ConsoleLayout title="Analytics">
      <div className="analytics-page-view">

        {/* Top Header matching Image 3 */}
        <div className="analytics-top-header">
          <div className="analytics-domain-badge">
            <span className="project-icon" style={{ width: 18, height: 18, fontSize: 10 }}>M</span>
            <span>www.mechhub.in</span>
            <ExternalLink size={12} color="#888" />
            <span className="online-tag">
              <span className="pulse-dot" style={{ width: 5, height: 5 }}></span>
              <span>0 online</span>
            </span>
          </div>

          <div className="flex-center gap-2">
            <button type="button" className="btn-add-filter">
              <span>Production</span>
              <ChevronDown size={13} />
            </button>
            <button type="button" className="btn-add-filter">
              <span>Last 7 Days</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </div>

        {/* 3 Metric Cards matching Image 3 */}
        <div className="analytics-stats-grid">
          <div className="analytics-stat-card">
            <div className="analytics-stat-label">Visitors</div>
            <div className="analytics-stat-val-row">
              <span className="analytics-big-num">74</span>
              <span className="analytics-change-badge">-14%</span>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-label">Page Views</div>
            <div className="analytics-stat-val-row">
              <span className="analytics-big-num">231</span>
              <span className="analytics-change-badge">-15%</span>
            </div>
          </div>

          <div className="analytics-stat-card">
            <div className="analytics-stat-label">Bounce Rate</div>
            <div className="analytics-stat-val-row">
              <span className="analytics-big-num">64%</span>
              <span className="analytics-change-badge positive">+13%</span>
            </div>
          </div>
        </div>

        {/* Main Line Chart Card matching Image 3 */}
        <div className="analytics-main-chart-card">
          <svg viewBox="0 0 800 200" style={{ width: '100%', height: '180px' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="0" y1="50" x2="800" y2="50" stroke="#151515" />
            <line x1="0" y1="100" x2="800" y2="100" stroke="#151515" />
            <line x1="0" y1="150" x2="800" y2="150" stroke="#151515" />

            {/* Blue Trend Line matching Image 3 */}
            <path
              d="M 50 140 L 150 140 L 250 140 L 350 70 L 450 110 L 550 110 L 650 65 L 750 180"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
            />

            {/* Dash line tail */}
            <line x1="650" y1="65" x2="750" y2="180" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
          </svg>

          {/* Time axis */}
          <div className="flex-center justify-between text-dim mono" style={{ fontSize: 11, marginTop: 8, padding: '0 40px' }}>
            <span>Oct 4</span>
            <span>Oct 5</span>
            <span>Oct 6</span>
            <span>Oct 7</span>
            <span>Oct 8</span>
            <span>Oct 9</span>
            <span>Oct 10</span>
            <span>Oct 11</span>
          </div>
        </div>

        {/* Sub-Tables Grid matching Image 3 */}
        <div className="analytics-tables-grid">

          {/* Pages Table */}
          <div className="analytics-table-card">
            <h4>Pages</h4>
            {pagesList.map((p, idx) => (
              <div key={idx} className="analytics-list-row">
                <span className="analytics-key">{p.path}</span>
                <span className="analytics-val">{p.views}</span>
              </div>
            ))}
          </div>

          {/* Referrers Table */}
          <div className="analytics-table-card">
            <h4>Referrers</h4>
            {referrersList.map((r, idx) => (
              <div key={idx} className="analytics-list-row">
                <span className="analytics-key">{r.name}</span>
                <span className="analytics-val">{r.count}</span>
              </div>
            ))}
          </div>

          {/* Countries */}
          <div className="analytics-table-card">
            <h4>Countries</h4>
            {countriesList.map((c, idx) => (
              <div key={idx} className="analytics-list-row">
                <span className="analytics-key">{c.flag} {c.name}</span>
                <span className="analytics-val">{c.share}</span>
              </div>
            ))}
          </div>

          {/* Devices & OS */}
          <div className="analytics-table-card">
            <h4>Devices & Operating Systems</h4>
            <div className="analytics-list-row">
              <span className="analytics-key">Desktop</span>
              <span className="analytics-val">66%</span>
            </div>
            <div className="analytics-list-row">
              <span className="analytics-key">Mobile</span>
              <span className="analytics-val">34%</span>
            </div>
            <div className="analytics-list-row">
              <span className="analytics-key">Windows</span>
              <span className="analytics-val">47%</span>
            </div>
            <div className="analytics-list-row">
              <span className="analytics-key">Android</span>
              <span className="analytics-val">28%</span>
            </div>
            <div className="analytics-list-row">
              <span className="analytics-key">GNU/Linux</span>
              <span className="analytics-val">12%</span>
            </div>
          </div>

        </div>

      </div>
    </ConsoleLayout>
  );
}
