import React from 'react';

const BAR_X = [640, 648, 656, 664, 672, 680, 688, 696, 704, 712, 720, 728, 736, 744, 752, 760, 768, 776];

const SERVERS = [
  {
    name: 'hetzner-vps',
    delay: '1.3s',
    y: 12,
    className: 'server sp-e15',
    rectClass: 'node sp-e15',
    unitClass: 'unit sp-e15',
    ledClass: 'led sp-e15',
    ledDeployClass: 'led led-deploy sp-e16',
    textClass: 'fill-fg-dim sp-e17',
    barClass: (i) => (i === 0 || i === 17 ? 'bar sp-e18' : `bar sp-e${19 + ((i - 1) % 16)}`),
    barDelays: ['-1.6s', '-0.2s', '-0.5s', '-0.8s', '-1.1s', '-1.4s', '0s', '-0.3s', '-0.6s', '-0.9s', '-1.2s', '-1.5s', '-0.1s', '-0.4s', '-0.7s', '-1s', '-1.3s', '-1.6s'],
  },
  {
    name: 'raspberry-pi',
    delay: '1.5s',
    y: 112,
    className: 'server sp-e35',
    rectClass: 'node sp-e35',
    unitClass: 'unit sp-e35',
    ledClass: 'led sp-e35',
    ledDeployClass: 'led led-deploy sp-e35',
    textClass: 'fill-fg-dim sp-e36',
    barClass: (i) => (i === 0 || i === 17 ? 'bar sp-e37' : `bar sp-e${38 + ((i - 1) % 16)}`),
    barDelays: ['-1.4s', '0s', '-0.3s', '-0.6s', '-0.9s', '-1.2s', '-1.5s', '-0.1s', '-0.4s', '-0.7s', '-1s', '-1.3s', '-1.6s', '-0.2s', '-0.5s', '-0.8s', '-1.1s', '-1.4s'],
  },
  {
    name: 'aws-ec2',
    delay: '1.7000000000000002s',
    y: 212,
    className: 'server sp-e54',
    rectClass: 'node sp-e54',
    unitClass: 'unit sp-e54',
    ledClass: 'led sp-e54',
    ledDeployClass: 'led led-deploy sp-e55',
    textClass: 'fill-fg-dim sp-e56',
    barClass: (i) => (i === 0 || i === 17 ? 'bar sp-e57' : `bar sp-e${58 + ((i - 1) % 16)}`),
    barDelays: ['-1.2s', '-1.5s', '-0.1s', '-0.4s', '-0.7s', '-1s', '-1.3s', '-1.6s', '-0.2s', '-0.5s', '-0.8s', '-1.1s', '-1.4s', '0s', '-0.3s', '-0.6s', '-0.9s', '-1.2s'],
  },
];

function ServerCard({ server }) {
  const { y } = server;
  return (
    <g className={server.className} style={{ '--d': server.delay }}>
      <rect x="620" y={y} width="180" height="76" rx="8" className={server.rectClass} />
      <rect x="630" y={y + 8} width="160" height="26" rx="4" className={server.unitClass} />
      <rect x="630" y={y + 42} width="160" height="26" rx="4" className={server.unitClass} />
      <circle cx="643" cy={y + 21} r="3" className={server.ledClass} />
      <circle cx="653" cy={y + 21} r="3" className={server.ledDeployClass} />
      <text x="664" y={y + 25} className={server.textClass} fontSize="11">{server.name}</text>
      {BAR_X.map((x, i) => (
        <rect
          key={`${server.name}-${x}`}
          x={x}
          y={y + 47}
          width="4"
          height="16"
          rx="1"
          className={server.barClass(i)}
          style={{ animationDelay: server.barDelays[i] }}
        />
      ))}
    </g>
  );
}

export default function ArchitectureFlow() {
  return (
    <section id="how-it-works" className="mt-28 scroll-mt-20 px-4 sp-e1" aria-label="How ShipStack deploys your code">
      <p className="eyebrow sp-e2">How it works</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg md:text-3xl sp-e3">
        Push your code. ShipStack does the rest.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-fg-faint sp-e4">
        ShipStack builds every commit and ships it to any server you connect over SSH.
      </p>
      <div className="mt-10 sp-e5">
        <div className="deploy-anim sp-e6">
          <svg
            viewBox="0 0 820 300"
            className="mx-auto w-full max-w-4xl font-mono sp-e7"
            role="img"
            aria-label="A git push goes to ShipStack, which deploys it to your servers"
          >
            <defs className="sp-e8">
              <radialGradient id="coolify-glow" className="sp-e8">
                <stop offset="0%" stopColor="var(--color-coollabs)" stopOpacity="0.55" className="sp-e8" />
                <stop offset="100%" stopColor="var(--color-coollabs)" stopOpacity="0" className="sp-e8" />
              </radialGradient>
            </defs>

            <path d="M190 150 L320 150" className="wire sp-e8" />
            <path d="M500 150 C560 150 560 50 620 50" className="wire sp-e8" />
            <path d="M500 150 L620 150" className="wire sp-e8" />
            <path d="M500 150 C560 150 560 250 620 250" className="wire sp-e8" />

            <circle r="4" className="packet sp-e9" style={{ offsetPath: "path('M190 150 L320 150')" }} />
            <circle r="4" className="packet packet-out sp-e10" style={{ offsetPath: "path('M500 150 C560 150 560 50 620 50')", animationDelay: '1.3s' }} />
            <circle r="4" className="packet packet-out sp-e10" style={{ offsetPath: "path('M500 150 L620 150')", animationDelay: '1.5s' }} />
            <circle r="4" className="packet packet-out sp-e9" style={{ offsetPath: "path('M500 150 C560 150 560 250 620 250')", animationDelay: '1.7000000000000002s' }} />

            <g className="sp-e8">
              <rect x="20" y="120" width="170" height="60" rx="10" className="node sp-e8" />
              <g className="stroke-fg-dim sp-e8" fill="none" strokeWidth="2" strokeLinecap="round">
                <circle cx="48" cy="140" r="4" className="sp-e8" />
                <circle cx="48" cy="162" r="4" className="sp-e8" />
                <circle cx="64" cy="146" r="4" className="sp-e8" />
                <path d="M48 144 V158 M64 150 C64 156 56 158 50 160" className="sp-e8" />
              </g>
              <text x="82" y="155" className="fill-fg sp-e11" fontSize="15">git push</text>
            </g>

            <circle cx="410" cy="150" r="110" fill="url(#coolify-glow)" className="glow sp-e12" />
            <g className="sp-e8">
              <rect x="320" y="105" width="180" height="90" rx="12" className="node node-coolify sp-e8" />
              <text x="410" y="145" textAnchor="middle" className="fill-fg font-sans sp-e13" fontSize="20" fontWeight="600">ShipStack</text>
              <text x="410" y="170" textAnchor="middle" className="fill-fg-faint sp-e14" fontSize="12">build · deploy · proxy</text>
            </g>

            {SERVERS.map((server) => (
              <ServerCard key={server.name} server={server} />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
