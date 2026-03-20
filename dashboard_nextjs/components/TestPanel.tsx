'use client';

import { useState, useEffect } from 'react';
import styles from './TestPanel.module.css';
import HowItWorksModal from './HowItWorksModal';

const HOW_BUTTONS = {
    title: 'Control Buttons — What Each Action Does',
    subtitle: 'Understand what happens on the blockchain when you click each button',
    steps: [
        {
            icon: '🚀',
            title: 'LAUNCH ENTIRE SYSTEM',
            description: 'Starts all 10 oracle processes and the OLT simulator simultaneously. All 20 OLTs begin sending SNMP V3 status signals (Operational) to their assigned oracle groups. After clicking, switch to the Analytical Dashboard to see the devices come online and the first blockchain votes appear.',
        },
        {
            icon: '💀',
            title: 'STOP N — Simulate Device Failure',
            description: 'Randomly stops N OLTs — they go silent and stop sending SNMP traps. After 70 seconds of silence, the responsible oracles automatically detect the timeout and vote for Offline on the blockchain. This simulates a real power failure or fiber cut. Watch the OLT cards turn black on the grid.',
        },
        {
            icon: '🚨',
            title: 'ALARM N — Simulate Alert Condition',
            description: 'Sets N random OLTs to Alarm state (status 2). The simulator sends SNMP traps with the new status to the oracle group. Oracles detect the change, queue a vote, and the Move contract processes it. Once quorum is reached the OLT card turns red. This is the most common SLA-triggering event.',
        },
        {
            icon: '🔄',
            title: 'RESET ALL OLTs — Restore Normal Operations',
            description: 'Brings all OLTs back to Operational status and resumes SNMP trap transmission. Oracles vote for recovery on-chain. A confirmed recovery event is also recorded immutably — useful for measuring exact downtime duration in SLA disputes.',
        },
        {
            icon: '🔌',
            title: 'KILL 1 (GRP A / GRP B) — Oracle Fault Injection',
            description: 'Terminates one oracle process in Group A or Group B. Tests the resilience of the consensus mechanism: the remaining 4 oracles in the group can still reach quorum (threshold = 3). The system continues to notarize state changes correctly — demonstrating fault tolerance.',
        },
        {
            icon: '⚡',
            title: 'RESTART ALL ORACLES — Recovery',
            description: 'Restarts all oracle processes that were previously killed. They reconnect to their SNMP ports and resume listening for device traps. Check the Oracle Network tab to confirm all processes return to Active status.',
        },
    ],
    footer: 'All actions generate real SNMP V3 traffic and real blockchain transactions on IOTA Testnet. Every confirmed event is permanently recorded and verifiable on the IOTA Explorer.',
};

export default function TestPanel() {
    const [status, setStatus] = useState<any>(null);
    const [killCount, setKillCount] = useState(1);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/simulation');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (e) {
            console.error("Failed to fetch simulation status", e);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const runAction = async (action: string, payload?: any) => {
        setLoading(true);
        try {
            const res = await fetch('/api/simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
            }
        } catch (e) {
            console.error("Simulation action failed", e);
        } finally {
            setLoading(false);
        }
    };

    const activeOracles = status?.oracles?.filter((o: any) => o.active).length || 0;
    const oltsSending1 = status?.olts?.filter((o: any) => o.active && o.status === 1).length || 0;
    const oltsSending2 = status?.olts?.filter((o: any) => o.active && o.status === 2).length || 0;
    const oltsStopped = status?.olts?.filter((o: any) => !o.active).length || 0;

    return (
        <div className={styles.testPage}>
            <div className="section-card">

                {/* Title row — same pattern as Analytical Dashboard sections */}
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>🛠️ SIM Test Center</span>
                    <HowItWorksModal {...HOW_BUTTONS} />
                </div>

                {/* Description */}
                <div className={styles.description}>
                    Manage the integrated Automata Protocol simulation and Oracle network directly from the dashboard.
                </div>

                <div className={styles.controlsRow}>
                    {/* SYSTEM START */}
                    <div className={styles.controlGroup}>
                        <div className={styles.groupLabel}>Master Control</div>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => runAction('START_ALL')}
                            disabled={loading || status?.isRunning}
                        >
                            🚀 LAUNCH ENTIRE SYSTEM
                        </button>
                    </div>

                    {/* OLT CONTROLS */}
                    <div className={styles.controlGroup}>
                        <div className={styles.groupLabel}>OLT Management</div>
                        <div className={styles.inputRow}>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={killCount}
                                onChange={(e) => {
                                    const parsed = parseInt(e.target.value);
                                    if (isNaN(parsed) || parsed <= 0) setKillCount(1);
                                    else if (parsed > 20) setKillCount(20);
                                    else setKillCount(parsed);
                                }}
                                className={styles.input}
                            />
                            <div className={styles.actionButtons}>
                                <button
                                    className={`${styles.btn} ${styles.btnDanger}`}
                                    onClick={() => runAction('STOP_RANDOM_OLTS', { count: killCount })}
                                    disabled={loading || !status?.isRunning}
                                >
                                    💀 STOP {killCount}
                                </button>
                                <button
                                    className={`${styles.btn} ${styles.btnAlarm}`}
                                    onClick={() => runAction('SET_RANDOM_ALARM', { count: killCount })}
                                    disabled={loading || !status?.isRunning}
                                >
                                    🚨 ALARM {killCount}
                                </button>
                            </div>
                        </div>
                        <button
                            className={`${styles.btn} ${styles.btnReset}`}
                            onClick={() => runAction('RESET_OLTS')}
                            disabled={loading || !status?.isRunning}
                        >
                            🔄 RESET ALL OLTs
                        </button>
                    </div>

                    {/* ORACLE CONTROLS */}
                    <div className={styles.controlGroup}>
                        <div className={styles.groupLabel}>Oracle Management</div>
                        <div className={styles.actionButtons}>
                            <button
                                className={`${styles.btn} ${styles.btnWarn}`}
                                onClick={() => runAction('STOP_ORACLE_A')}
                                disabled={loading || !status?.isRunning}
                            >
                                🔌 KILL 1 (GRP A)
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnWarn}`}
                                onClick={() => runAction('STOP_ORACLE_B')}
                                disabled={loading || !status?.isRunning}
                            >
                                🔌 KILL 1 (GRP B)
                            </button>
                        </div>
                        <button
                            className={`${styles.btn} ${styles.btnSuccess}`}
                            onClick={() => runAction('RESTART_ORACLES')}
                            disabled={loading || !status?.isRunning}
                        >
                            ⚡ RESTART ALL ORACLES
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.statsRow}>
                <div className="section-card" style={{ flex: 1 }}>
                    <div className="section-title">📊 Simulation Stats</div>
                    <div className={styles.statItem}>
                        <span>Active Oracles:</span>
                        <span className={activeOracles > 0 ? styles.activeText : styles.inactiveText}>
                            {activeOracles} / 10
                        </span>
                    </div>
                    <div className={styles.statItem}>
                        <span>OLTs Sending [1]:</span>
                        <span className={oltsSending1 > 0 ? styles.activeText : styles.inactiveText}>
                            {oltsSending1}
                        </span>
                    </div>
                    <div className={styles.statItem}>
                        <span>OLTs Sending [2]:</span>
                        <span className={oltsSending2 > 0 ? styles.alarmText : styles.inactiveText}>
                            {oltsSending2}
                        </span>
                    </div>
                    <div className={styles.statItem}>
                        <span>OLTs NOT Sending:</span>
                        <span className={oltsStopped > 0 ? styles.dangerText : styles.inactiveText}>
                            {oltsStopped}
                        </span>
                    </div>
                </div>

                <div className="section-card" style={{ flex: 2 }}>
                    <div className="section-title">📜 Console Log (Internal)</div>
                    <div className={styles.consolePlaceholder}>
                        <p>Simulation running in dashboard process. Check server logs for detailed SNMP V3 and Transaction events.</p>

                        <div className={styles.logLinks}>
                            <strong>Oracle Logs:</strong>
                            <div className={styles.logButtons}>
                                {[...Array(10)].map((_, i) => (
                                    <a
                                        key={i}
                                        href={`/api/logs?id=${i + 1}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.logLink}
                                    >
                                        Log #{i + 1}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {status?.isRunning ? (
                            <div className={styles.runningBadge}>● ACTIVE</div>
                        ) : (
                            <div className={styles.stoppedBadge}>○ STOPPED</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
