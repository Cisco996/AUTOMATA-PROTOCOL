'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { OltState, OltEvent, OltStatus } from '@/lib/iota';
import OltGrid from '@/components/OltGrid';
import StatusChart from '@/components/StatusChart';
import AuditLog from '@/components/AuditLog';
import OracleDashboard from '@/components/OracleDashboard';
import HowItWorksModal from '@/components/HowItWorksModal';

const CyberGrid = dynamic(() => import('@/components/CyberGrid'), { ssr: false });
const ItalyMap = dynamic(() => import('@/components/ItalyMap'), { ssr: false });

type Page = 'dashboard' | 'map' | 'oracles' | 'test';
import TestPanel from '@/components/TestPanel';

interface DashboardData {
  statuses: OltState[];
  events: OltEvent[];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// HOW IT WORKS — content definitions per section
// ─────────────────────────────────────────────

const HOW_OLT_GRID = {
  title: 'Live Device Status Grid',
  subtitle: 'Real-time certified state of each OLT on the IOTA blockchain',
  steps: [
    {
      icon: '📡',
      title: 'DEVICE SIGNAL',
      description: 'Each OLT continuously sends SNMP V3 traps — encrypted status signals — to its assigned oracle group. No human reads these signals.',
    },
    {
      icon: '🤖',
      title: 'ORACLE DETECTION',
      description: 'The oracle process detects any state change (Operational / Alarm / Offline) and queues a signed vote transaction. If no signal arrives within 70 seconds, the oracle automatically votes for Offline.',
    },
    {
      icon: '🗳️',
      title: 'CONSENSUS VOTING',
      description: 'Multiple independent oracles vote for the same state. The Move smart contract on IOTA collects votes and checks against the quorum threshold. A single oracle cannot unilaterally certify any state.',
    },
    {
      icon: '✅',
      title: 'ON-CHAIN CERTIFICATION',
      description: 'Once quorum is reached, the OLT state is officially updated on the IOTA blockchain with a cryptographic timestamp. This is the certified state you see on this grid.',
    },
  ],
  footer: 'Each card shows the current certified state (confirmed by quorum), the oracle group responsible, and the last oracle that contributed to consensus.',
};

const HOW_STATUS_CHART = {
  title: 'Operational History Analysis',
  subtitle: 'How long each OLT spent in each state — derived from blockchain events',
  steps: [
    {
      icon: '📜',
      title: 'BLOCKCHAIN EVENT LOG',
      description: 'Every state change confirmed on-chain emits an event with OLT ID, new status, timestamp, and oracle ID. The dashboard reads up to 1,000 of these events from the IOTA node.',
    },
    {
      icon: '⏱️',
      title: 'TIME-IN-STATE CALCULATION',
      description: 'The chart calculates how long each OLT remained in each state by measuring the time between consecutive confirmed events. This creates an immutable operational history.',
    },
    {
      icon: '🔍',
      title: 'FILTER BY DEVICE & DATE',
      description: 'Use the sidebar filters to analyze a specific OLT or a specific time window. All data comes directly from the blockchain — no internal logs, no manipulation possible.',
    },
  ],
  footer: 'This chart is the foundation for SLA dispute resolution: it shows exactly when a device was operational, in alarm, or offline — with cryptographic proof for each data point.',
};

const HOW_AUDIT_LOG = {
  title: 'Full Audit Log',
  subtitle: 'Every blockchain event — verified, immutable, publicly accessible',
  steps: [
    {
      icon: '🔗',
      title: 'EVERY ROW IS A REAL TRANSACTION',
      description: 'Each entry in this log corresponds to a real signed transaction on the IOTA Testnet. It was submitted by an oracle, processed by the Move smart contract, and permanently stored on-chain.',
    },
    {
      icon: '🗳️',
      title: 'CONFIRMED vs PENDING VOTES',
      description: 'The "Confirmed" column indicates whether this event reached quorum. A vote that did not yet reach quorum is still recorded on-chain — it contributes to the consensus process.',
    },
    {
      icon: '🔍',
      title: 'VERIFY ON IOTA EXPLORER',
      description: 'Every confirmed event includes a direct link to the IOTA Explorer. Anyone — the provider, the customer, a regulator — can independently verify the transaction without trusting any internal system.',
    },
  ],
  footer: 'This audit log is the neutral source of truth for SLA verification. It cannot be altered after the fact by any party.',
};

const HOW_ORACLE_NETWORK = {
  title: 'Oracle Network',
  subtitle: '10 independent processes that bridge physical devices to the blockchain',
  steps: [
    {
      icon: '⚙️',
      title: 'WHAT IS AN ORACLE?',
      description: 'An oracle is an independent software process that observes a physical device and translates its state into a blockchain transaction. It acts as a neutral, automated witness — no human decides what to report.',
    },
    {
      icon: '🔐',
      title: 'CRYPTOGRAPHIC IDENTITY',
      description: 'Each oracle has a unique Ed25519 keypair. Every vote is signed with this key, making it cryptographically attributable. No oracle can deny its votes, and no external party can forge them.',
    },
    {
      icon: '👥',
      title: 'GROUP ISOLATION',
      description: 'Oracles are divided into Group A (OLT 1–10) and Group B (OLT 11–20). Each oracle can only vote for its assigned group — a rule enforced by the Move contract, not by the JS code.',
    },
    {
      icon: '🛡️',
      title: 'THE CONTRACT DECIDES',
      description: 'The Move smart contract is the source of authority. Even if an oracle is compromised, it cannot vote for unauthorized groups, double-vote, or unilaterally confirm a state. All rules are immutable on-chain.',
    },
  ],
  footer: 'Active Oracles shows live process health (HTTP health check). Votes and Confirmed are derived from blockchain events — the ground truth.',
};

const HOW_TEST_PANEL = {
  title: 'SIM Test Center — Overview',
  subtitle: 'What this page is and why it exists',
  steps: [
    {
      icon: '🎮',
      title: 'WHY A SIMULATOR?',
      description: 'Physical OLT hardware is not required to demonstrate the system. The simulator generates authentic SNMP V3 traps — the same protocol used by real Cisco, Nokia, and Huawei devices — sent directly to the oracle processes.',
    },
    {
      icon: '📤',
      title: 'HOW EVENTS ARE TRIGGERED',
      description: 'When you trigger a state change here, the simulator sends an encrypted SNMP V3 trap to the responsible oracle group. The oracles receive it exactly as they would from real hardware and begin the blockchain voting process.',
    },
    {
      icon: '⛓️',
      title: 'WATCH THE CHAIN REACT',
      description: 'After triggering an action, switch to the Analytical Dashboard or Oracle Network tab to watch in real time: oracles vote, the quorum counter increases, and when the threshold is reached the OLT state updates on-chain.',
    },
    {
      icon: '🏭',
      title: 'SAME CODE, REAL HARDWARE',
      description: 'The oracle listener code does not change for real hardware. Only the SNMP source changes — from this simulator to an actual OLT device. The blockchain layer is completely hardware-agnostic.',
    },
  ],
  footer: 'All events triggered here result in real transactions on the IOTA Testnet. You can verify them on the IOTA Explorer after they are confirmed.',
};

// ─────────────────────────────────────────────

export default function Home() {
  const [page, setPage] = useState<Page>('dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [data, setData] = useState<DashboardData>({ statuses: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('—');
  const [visited, setVisited] = useState<Record<string, boolean>>({ dashboard: true });
  const [oltFilter, setOltFilter] = useState('All');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error('API error');
      const json: DashboardData = await res.json();
      setData(json);
      setLastUpdate(new Date().toLocaleTimeString('it-IT'));
    } catch (err) {
      console.error('fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(fetchData, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  // Build maps from statuses
  const statusMap: Record<string, OltStatus> = {};
  const groupMap: Record<string, number> = {};
  for (const s of data.statuses) {
    statusMap[s.oltId] = s.status;
    groupMap[s.oltId] = s.groupId;
  }

  // Build lastOracle map from events
  const lastOracleMap: Record<string, number> = {};
  for (const ev of data.events) {
    if (ev.confirmed && !lastOracleMap[ev.oltId]) {
      lastOracleMap[ev.oltId] = ev.oracleId;
    }
  }

  const opCount = Object.values(statusMap).filter(s => s === 1).length;
  const alCount = Object.values(statusMap).filter(s => s === 2).length;
  const ofCount = 20 - opCount - alCount;

  return (
    <>
      <CyberGrid />

      <div className="dashboard-layout">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-title">📡 Automata Protocol</div>
            <div className="sidebar-logo-sub">V6 // TS SDK EDITION</div>
          </div>

          {/* Navigation */}
          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            <button
              className={`nav-btn ${page === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setPage('dashboard'); setVisited(prev => ({ ...prev, dashboard: true })); }}
            >
              📊 Analytical Dashboard
            </button>
            <button
              className={`nav-btn ${page === 'map' ? 'active' : ''}`}
              onClick={() => { setPage('map'); setVisited(prev => ({ ...prev, map: true })); }}
            >
              🗺️ Italy Map
            </button>
            <button
              className={`nav-btn ${page === 'oracles' ? 'active' : ''}`}
              onClick={() => { setPage('oracles'); setVisited(prev => ({ ...prev, oracles: true })); }}
            >
              🤖 Oracle Network
            </button>
            <button
              className={`nav-btn ${page === 'test' ? 'active' : ''}`}
              onClick={() => { setPage('test'); setVisited(prev => ({ ...prev, test: true })); }}
            >
              🛠️ SIM Test Center
            </button>
          </div>

          <div className="divider" />

          {/* Filters */}
          <div className="sidebar-section">
            <div className="sidebar-label">Filters</div>

            <div className="form-group">
              <label className="form-label">Device ID Filter</label>
              <select
                className="form-select"
                value={oltFilter}
                onChange={e => setOltFilter(e.target.value)}
              >
                <option value="All">All</option>
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status indicator at bottom */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="refresh-indicator">
              <span className="pulse-dot" />
              Updated {lastUpdate}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="main-content">

          {/* Header */}
          <div className="page-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>
                  {page === 'dashboard' ? '📡 Automata Protocol V6' :
                    page === 'map' ? '📍 OLT Geolocation (Live)' :
                      page === 'test' ? '🛠️ SIM Test Center' : '🤖 Oracle Network'}
                </h1>
                {page === 'test' && <HowItWorksModal {...HOW_TEST_PANEL} />}
                {page === 'oracles' && <HowItWorksModal {...HOW_ORACLE_NETWORK} />}
              </div>
              <p className="page-subtitle">
                IOTA REBASED TESTNET // SDK EDITION
              </p>
            </div>
            {!loading && (
              <div className="status-pill online">
                <span style={{ fontSize: '0.55rem' }}>●</span> LIVE
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--cyber-green)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.9rem', letterSpacing: '0.1em' }}>
              ⟳ CONNECTING TO BLOCKCHAIN...
            </div>
          ) : (
            <>
              {/* ── DASHBOARD PAGE ── */}
              {visited.dashboard && (
                <div style={{ display: page === 'dashboard' ? 'block' : 'none' }}>
                  {/* Metrics */}
                  <div className="metrics-row">
                    <div className="metric-card">
                      <div className="metric-label">🟢 Operational</div>
                      <div className="metric-value green">{opCount}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}> / 20</span></div>
                      <div className="metric-sub">Devices online</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">🔴 Alarm</div>
                      <div className="metric-value red">{alCount}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}> / 20</span></div>
                      <div className="metric-sub">Devices in alert</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">⚫ Offline</div>
                      <div className="metric-value gray">{ofCount}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}> / 20</span></div>
                      <div className="metric-sub">Devices unreachable</div>
                    </div>
                  </div>

                  {/* OLT Grid */}
                  <div className="section-card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📟 Live Device Status Grid</span>
                      <HowItWorksModal {...HOW_OLT_GRID} />
                    </div>
                    <OltGrid
                      statuses={data.statuses}
                      statusMap={statusMap}
                      groupMap={groupMap}
                      lastOracleMap={lastOracleMap}
                    />
                  </div>

                  {/* Chart */}
                  <div className="section-card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📊 Operational History Analysis (Time in State)</span>
                      <HowItWorksModal {...HOW_STATUS_CHART} />
                    </div>
                    <StatusChart
                      events={data.events}
                      startDate={startDate}
                      endDate={endDate}
                      oltFilter={oltFilter}
                    />
                  </div>

                  {/* Audit Log */}
                  <div className="section-card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📜 Full Audit Log (Filtered Events)</span>
                      <HowItWorksModal {...HOW_AUDIT_LOG} />
                    </div>
                    <AuditLog
                      events={data.events}
                      startDate={startDate}
                      endDate={endDate}
                      oltFilter={oltFilter}
                    />
                  </div>
                </div>
              )}

              {/* ── MAP PAGE ── */}
              {visited.map && (
                <div
                  className="section-card"
                  style={page === 'map' ? {} : { position: 'absolute', opacity: 0, pointerEvents: 'none', top: '-9999px', width: '100%', left: 0 }}
                >
                  <div className="section-title">📍 OLT Geolocation — Italy</div>
                  <ItalyMap statusMap={statusMap} />
                </div>
              )}

              {/* ── ORACLES PAGE ── */}
              {visited.oracles && (
                <div style={{ display: page === 'oracles' ? 'block' : 'none' }}>
                  <OracleDashboard
                    events={data.events}
                    oltFilter={oltFilter}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </div>
              )}

              {/* ── TEST PAGE ── */}
              {visited.test && (
                <div style={{ display: page === 'test' ? 'block' : 'none' }}>
                  <TestPanel />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
