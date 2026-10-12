import React from 'react';
import {
  GitHubMark,
  AmazonSqsLogo,
  AiRagLogo,
  KafkaLogo,
  ClickHouseLogo,
  AwsEcsLogo,
  AmazonS3Logo,
  ReverseProxyLogo,
  RagLogo,
  LiveSiteLogo,
} from './BrandIcons';



const deployNodes = [
  { id: 'git', label: 'Git', x: 90, logo: GitHubMark },
  { id: 'sqs', label: 'SQS', x: 270, logo: AmazonSqsLogo },
  { id: 'ecs', label: 'ECS', x: 450, logo: AwsEcsLogo, fork: true },
  { id: 's3', label: 'S3', x: 630, logo: AmazonS3Logo },
  { id: 'proxy', label: 'Proxy', x: 810, logo: ReverseProxyLogo },
  { id: 'live', label: 'Live', x: 990, logo: LiveSiteLogo, live: true },
];

const intelNodes = [
  { id: 'kafka', label: 'Kafka', x: 450, logo: KafkaLogo },
  { id: 'clickhouse', label: 'ClickHouse', x: 630, logo: ClickHouseLogo },
  { id: 'ai', label: 'AI', x: 810, logo: AiRagLogo },
  { id: 'rag', label: 'RAG', x: 990, logo: RagLogo },
];

const DEPLOY_Y = 128;
const INTEL_Y = 352;

function NodeCard({ id, label, x, y, logo: Logo, live, fork }) {
  return (
    <div
      className={`arch-node${live ? ' is-live' : ''}${fork ? ' is-fork' : ''}`}
      style={{ left: `${(x / 1100) * 100}%`, top: `${(y / 500) * 100}%` }}
      data-node={id}
    >
      <div className="arch-node-logo">
        <Logo size={28} />
      </div>
      <span className="arch-node-name">{label}</span>
      {live && <span className="arch-live-dot" />}
      <span className="arch-node-hit" />
    </div>
  );
}

export default function ArchitectureFlow() {
  const deployPath = `M90,${DEPLOY_Y} H990`;
  const forkPath = `M450,${DEPLOY_Y} V${INTEL_Y}`;
  const intelPath = `M450,${INTEL_Y} H990`;
  const mergePath = `M990,${INTEL_Y} V${DEPLOY_Y}`;
  const cursorDeploy = `M90,${DEPLOY_Y} H270 H450 H630 H810 H990`;
  const cursorIntel = `M450,${DEPLOY_Y} V${INTEL_Y} H630 H810 H990 V${DEPLOY_Y}`;

  return (
    <section className="infra-section" aria-label="Deployment architecture">
      <div className="infra-section-inner">
        <div className="infra-section-head">
          <span className="marketing-eyebrow">BATTLE-TESTED INFRASTRUCTURE</span>
          <h2>Push → build → live.</h2>
        </div>

        <div className="arch-stage">
          <svg className="arch-wires" viewBox="0 0 1100 500" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="arch-deploy-stroke" x1="90" y1="0" x2="990" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" />
                <stop offset="0.45" stopColor="#fb923c" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="arch-intel-stroke" x1="450" y1="0" x2="990" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e87d19" />
                <stop offset="0.55" stopColor="#c084fc" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
              <filter id="arch-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path d={deployPath} stroke="url(#arch-deploy-stroke)" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
            <path d={forkPath} stroke="#e87d19" strokeWidth="2.2" strokeDasharray="6 6" strokeLinecap="round" opacity="0.9" />
            <path d={intelPath} stroke="url(#arch-intel-stroke)" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
            <path d={mergePath} stroke="#34d399" strokeWidth="2.2" strokeDasharray="5 6" strokeLinecap="round" opacity="0.85" />

            <circle r="3.2" fill="#fb923c" filter="url(#arch-glow)">
              <animateMotion dur="3.6s" repeatCount="indefinite" path={deployPath} />
            </circle>
            <circle r="3.2" fill="#c084fc" filter="url(#arch-glow)">
              <animateMotion dur="4.2s" repeatCount="indefinite" begin="1.1s" path={cursorIntel} />
            </circle>

            <g transform="translate(468 228)">
              <rect width="86" height="22" rx="11" fill="#0b0b0c" stroke="rgba(232,125,25,0.55)" />
              <text x="43" y="15" textAnchor="middle" fill="#fbbf24" fontSize="9" fontFamily="JetBrains Mono, monospace">
                BUILD LOGS
              </text>
            </g>
            <g transform="translate(900 228)">
              <rect width="70" height="22" rx="11" fill="#0b0b0c" stroke="rgba(52,211,153,0.5)" />
              <text x="35" y="15" textAnchor="middle" fill="#6ee7b7" fontSize="9" fontFamily="JetBrains Mono, monospace">
                HEAL
              </text>
            </g>
          </svg>

          <span className="arch-lane-tag deploy">Deploy</span>
          <span className="arch-lane-tag intel">Intelligence</span>

          {deployNodes.map((node) => (
            <NodeCard key={node.id} {...node} y={DEPLOY_Y} />
          ))}
          {intelNodes.map((node) => (
            <NodeCard key={node.id} {...node} y={INTEL_Y} />
          ))}

          <svg className="arch-cursors" viewBox="0 0 1100 500" fill="none" aria-hidden="true">
            <defs>
              <filter id="cursor-shadow" x="-50%" y="-50%" width="220%" height="220%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#000" floodOpacity="0.6" />
              </filter>
            </defs>
            <path id="arch-cursor-deploy" d={cursorDeploy} />
            <path id="arch-cursor-intel" d={cursorIntel} />

            <g filter="url(#cursor-shadow)" className="arch-pointer">
              <animateMotion dur="9s" rotate="0" repeatCount="indefinite" keyTimes="0;0.08;0.16;0.24;0.32;0.4;0.48;0.56;0.64;0.72;0.8;1" keyPoints="0;0;0.2;0.2;0.4;0.4;0.6;0.6;0.8;0.8;1;1" calcMode="linear">
                <mpath href="#arch-cursor-deploy" />
              </animateMotion>
              <circle fill="rgba(255,255,255,0.28)">
                <animate attributeName="r" values="0;13;0" dur="0.85s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;0" dur="0.85s" repeatCount="indefinite" />
              </circle>
              <path d="M0 0 L0 17.5 L4.8 13.2 L8.6 21.4 L11.2 20.2 L7.2 12 L14 11.6 Z" fill="#ffffff" stroke="#111111" strokeWidth="1" strokeLinejoin="round" />
            </g>

            <g filter="url(#cursor-shadow)" className="arch-pointer">
              <animateMotion dur="9s" rotate="0" repeatCount="indefinite" begin="1.6s" keyTimes="0;0.08;0.16;0.24;0.32;0.4;0.48;0.56;0.64;0.72;0.86;1" keyPoints="0;0;0.227;0.227;0.409;0.409;0.591;0.591;0.773;0.773;1;1" calcMode="linear">
                <mpath href="#arch-cursor-intel" />
              </animateMotion>
              <circle fill="rgba(192,132,252,0.35)">
                <animate attributeName="r" values="0;13;0" dur="0.85s" repeatCount="indefinite" begin="2.1s" />
                <animate attributeName="opacity" values="0.5;0" dur="0.85s" repeatCount="indefinite" begin="2.1s" />
              </circle>
              <path d="M0 0 L0 17.5 L4.8 13.2 L8.6 21.4 L11.2 20.2 L7.2 12 L14 11.6 Z" fill="#f5d0fe" stroke="#3b0764" strokeWidth="1" strokeLinejoin="round" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
