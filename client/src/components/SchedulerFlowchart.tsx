export function SchedulerFlowchart() {
  const YES = "#34d399";
  const NO = "#f87171";
  const NODE_BG = "#0c1a2e";
  const NODE_BORDER = "#34d399";
  const ACTION_BG = "#0f1e35";
  const ACTION_BORDER = "#1e3a5f";
  const TEXT_PRIMARY = "#e2e8f0";
  const TEXT_DIM = "#94a3b8";
  const TEXT_CODE = "#86efac";
  const START_BG = "#042f1e";

  return (
    <svg
      viewBox="0 0 1100 510"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      style={{ background: "#080f1a", borderRadius: 12 }}
    >
      <defs>
        {/* Arrow markers */}
        <marker id="arrow-yes" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={YES} />
        </marker>
        <marker id="arrow-no" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={NO} />
        </marker>
        <marker id="arrow-dim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
        </marker>
        {/* Glow filter for start node */}
        <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── START node ── */}
      <ellipse cx="120" cy="60" rx="100" ry="34" fill={START_BG} stroke={NODE_BORDER} strokeWidth="2" filter="url(#glow-green)" />
      <text x="120" y="55" textAnchor="middle" fill={YES} fontSize="11" fontWeight="700" fontFamily="monospace">SCHEDULER</text>
      <text x="120" y="70" textAnchor="middle" fill={YES} fontSize="11" fontWeight="700" fontFamily="monospace">OVERSUBSCRIBED?</text>

      {/* START → YES branch (right) */}
      <line x1="220" y1="60" x2="296" y2="60" stroke={YES} strokeWidth="1.5" markerEnd="url(#arrow-yes)" />
      <text x="257" y="54" textAnchor="middle" fill={YES} fontSize="10" fontWeight="600">YES</text>

      {/* START → NO branch (down-left) */}
      <line x1="120" y1="94" x2="120" y2="390" stroke={NO} strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="120" y1="390" x2="296" y2="390" stroke={NO} strokeWidth="1.5" markerEnd="url(#arrow-no)" />
      <text x="85" y="245" textAnchor="middle" fill={NO} fontSize="10" fontWeight="600" transform="rotate(-90 85 245)">NO → Can I increase concurrent load?</text>

      {/* ── DECISION 1: Constant oversubscription? ── */}
      {/* diamond at x=370 y=60 */}
      <polygon points="370,30 470,60 370,90 270,60" fill={NODE_BG} stroke={NODE_BORDER} strokeWidth="1.5" />
      <text x="370" y="55" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="10" fontWeight="600">Constant</text>
      <text x="370" y="69" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="10" fontWeight="600">Oversubscription?</text>

      {/* D1 → YES (right) */}
      <line x1="470" y1="60" x2="546" y2="60" stroke={YES} strokeWidth="1.5" markerEnd="url(#arrow-yes)" />
      <text x="507" y="54" textAnchor="middle" fill={YES} fontSize="10" fontWeight="600">YES</text>

      {/* D1 → NO (down) */}
      <line x1="370" y1="90" x2="370" y2="156" stroke={NO} strokeWidth="1.5" markerEnd="url(#arrow-no)" />
      <text x="385" y="126" fill={NO} fontSize="10" fontWeight="600">NO</text>

      {/* ── ACTION: Peak-times oversubscription ── */}
      <rect x="270" y="158" width="200" height="76" rx="8" fill={ACTION_BG} stroke={ACTION_BORDER} strokeWidth="1.5" />
      <text x="370" y="175" textAnchor="middle" fill={TEXT_DIM} fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="0.08em">SCHEDULE TUNING</text>
      <line x1="280" y1="181" x2="460" y2="181" stroke={ACTION_BORDER} strokeWidth="1" />
      <text x="370" y="197" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">adjust cron schedule</text>
      <text x="370" y="212" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">schedule windows</text>
      <text x="370" y="227" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">allow_skew</text>

      {/* ── DECISION 2: Indexers have CPU? ── */}
      <polygon points="620,30 740,60 620,90 500,60" fill={NODE_BG} stroke={NODE_BORDER} strokeWidth="1.5" />
      <text x="620" y="48" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">Do Indexers have CPU</text>
      <text x="620" y="62" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">capacity for additional</text>
      <text x="620" y="76" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">concurrent search load?</text>

      {/* D2 → YES (right) */}
      <line x1="740" y1="60" x2="816" y2="60" stroke={YES} strokeWidth="1.5" markerEnd="url(#arrow-yes)" />
      <text x="777" y="54" textAnchor="middle" fill={YES} fontSize="10" fontWeight="600">YES</text>

      {/* D2 → NO (down) */}
      <line x1="620" y1="90" x2="620" y2="156" stroke={NO} strokeWidth="1.5" markerEnd="url(#arrow-no)" />
      <text x="635" y="126" fill={NO} fontSize="10" fontWeight="600">NO</text>

      {/* ── ACTION: Indexer capacity ── */}
      <rect x="510" y="158" width="220" height="92" rx="8" fill={ACTION_BG} stroke={ACTION_BORDER} strokeWidth="1.5" />
      <text x="620" y="175" textAnchor="middle" fill={TEXT_DIM} fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="0.08em">INDEXER CAPACITY</text>
      <line x1="520" y1="181" x2="720" y2="181" stroke={ACTION_BORDER} strokeWidth="1" />
      <text x="620" y="197" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">add more Indexers</text>
      <text x="620" y="212" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">increase Indexer CPUs</text>
      <text x="620" y="227" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">reduce concurrent</text>
      <text x="620" y="242" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">search load</text>

      {/* ── DECISION 3: Search Heads have CPU? ── */}
      <polygon points="900,30 1020,60 900,90 780,60" fill={NODE_BG} stroke={NODE_BORDER} strokeWidth="1.5" />
      <text x="900" y="48" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">Do Search Heads have CPU</text>
      <text x="900" y="62" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">capacity for additional</text>
      <text x="900" y="76" textAnchor="middle" fill={TEXT_PRIMARY} fontSize="9.5" fontWeight="600">concurrent search load?</text>

      {/* D3 → YES (down-right) */}
      <line x1="900" y1="90" x2="900" y2="156" stroke={YES} strokeWidth="1.5" markerEnd="url(#arrow-yes)" />
      <text x="915" y="126" fill={YES} fontSize="10" fontWeight="600">YES</text>

      {/* D3 → NO (down-left, longer path) */}
      <line x1="900" y1="90" x2="900" y2="110" stroke={NO} strokeWidth="1.5" />
      <line x1="900" y1="110" x2="780" y2="110" stroke={NO} strokeWidth="1.5" />
      <line x1="780" y1="110" x2="780" y2="390" stroke={NO} strokeWidth="1.5" />
      <line x1="780" y1="390" x2="836" y2="390" stroke={NO} strokeWidth="1.5" markerEnd="url(#arrow-no)" />
      <text x="840" y="106" fill={NO} fontSize="10" fontWeight="600">NO</text>

      {/* ── ACTION: limits.conf ── */}
      <rect x="790" y="158" width="220" height="108" rx="8" fill={ACTION_BG} stroke={ACTION_BORDER} strokeWidth="1.5" />
      <text x="900" y="175" textAnchor="middle" fill={TEXT_DIM} fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="0.08em">LIMITS.CONF (SH)</text>
      <line x1="800" y1="181" x2="1000" y2="181" stroke={ACTION_BORDER} strokeWidth="1" />
      <text x="900" y="197" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">max_searches_per_cpu</text>
      <text x="900" y="212" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">base_max_searches</text>
      <text x="900" y="227" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">max_searches_perc</text>
      <line x1="800" y1="238" x2="1000" y2="238" stroke={ACTION_BORDER} strokeWidth="1" />
      <text x="900" y="252" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="monospace">or add SHs to SHC</text>

      {/* ── ACTION: add SHs (NO from D3) ── */}
      <rect x="836" y="365" width="228" height="76" rx="8" fill={ACTION_BG} stroke={ACTION_BORDER} strokeWidth="1.5" />
      <text x="950" y="382" textAnchor="middle" fill={TEXT_DIM} fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="0.08em">SEARCH HEAD CAPACITY</text>
      <line x1="846" y1="388" x2="1054" y2="388" stroke={ACTION_BORDER} strokeWidth="1" />
      <text x="950" y="404" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">add SHs to SHC</text>
      <text x="950" y="419" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">increase CPU on SHs</text>
      <text x="950" y="434" textAnchor="middle" fill={TEXT_CODE} fontSize="10" fontFamily="monospace">increase max_searches_perc</text>

      {/* NO path label mid-segment */}
      <text x="786" y="252" fill={NO} fontSize="10" fontWeight="600" transform="rotate(-90 786 252)">NO</text>

      {/* ── Legend ── */}
      <line x1="30" y1="470" x2="60" y2="470" stroke={YES} strokeWidth="1.5" markerEnd="url(#arrow-yes)" />
      <text x="65" y="474" fill={YES} fontSize="10">YES path</text>
      <line x1="150" y1="470" x2="180" y2="470" stroke={NO} strokeWidth="1.5" markerEnd="url(#arrow-no)" />
      <text x="185" y="474" fill={NO} fontSize="10">NO path</text>
      <line x1="270" y1="470" x2="300" y2="470" stroke={NO} strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="305" y="474" fill={TEXT_DIM} fontSize="10">alternate entry (not constant)</text>
    </svg>
  );
}
