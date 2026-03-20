'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { OltEvent } from '@/lib/iota';
import { OracleHealth } from '@/app/api/oracles/route';
import styles from './OracleDashboard.module.css';

interface Props {
    events: OltEvent[];
    oltFilter: string;
    startDate: string;
    endDate: string;
}

const GROUP_A_IDS = [1, 2, 3, 4, 5];
const ORACLE_COUNT = 10;

const COL_GREEN = '#00e054';
const COL_RED = '#ff3131';
const COL_BLUE = '#00aaff';
const COL_YELLOW = '#ffd700';
const COL_GRAY = '#4a6080';

function formatUptime(sec: number): string {
    if (sec <= 0) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// Filter events by OLT and date range (same logic as the other components)
function filterEvents(events: OltEvent[], oltFilter: string, startDate: string, endDate: string): OltEvent[] {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;
    return events.filter(ev => {
        if (oltFilter !== 'All' && ev.oltId !== oltFilter) return false;
        if (ev.datetime < start || ev.datetime > end) return false;
        return true;
    });
}

export default function OracleDashboard({ events, oltFilter, startDate, endDate }: Props) {

    // ── Live oracle health ────────────────────────────────────────
    const [health, setHealth] = useState<OracleHealth[]>([]);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/oracles', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            setHealth(data.oracles ?? []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchHealth();
        const t = setInterval(fetchHealth, 1000); // 1s live refresh
        return () => clearInterval(t);
    }, [fetchHealth]);

    const healthMap = useMemo(() => {
        const m: Record<number, OracleHealth> = {};
        for (const h of health) m[h.oracle_id] = h;
        return m;
    }, [health]);

    const activeCount = health.filter(h => h.status === 'active').length;

    // ── Filtered events ───────────────────────────────────────────
    const filtered = useMemo(
        () => filterEvents(events, oltFilter, startDate, endDate),
        [events, oltFilter, startDate, endDate]
    );

    // ── Derived blockchain stats + Live attempts ──────────────────
    const stats = useMemo(() => {
        const votesByOracle: Record<number, number> = {};
        for (let i = 1; i <= ORACLE_COUNT; i++) votesByOracle[i] = 0;
        const confirmedByOracle: Record<number, number> = {};
        for (let i = 1; i <= ORACLE_COUNT; i++) confirmedByOracle[i] = 0;

        let confirmOp = 0, confirmAlarm = 0, confirmOffline = 0;
        let groupAVotes = 0, groupBVotes = 0;

        // Cumulative attempts from live oracles (health state)
        for (const ev of filtered) {
            const oid = ev.oracleId;
            if (oid < 1 || oid > ORACLE_COUNT) continue;

            // Count every vote (confirmed or not) per oracle
            votesByOracle[oid] = (votesByOracle[oid] || 0) + 1;

            if (ev.confirmed) {
                confirmedByOracle[oid] = (confirmedByOracle[oid] || 0) + 1;
                if (ev.status === 1) confirmOp++;
                else if (ev.status === 2) confirmAlarm++;
                else confirmOffline++;
            }
            if (GROUP_A_IDS.includes(oid)) groupAVotes++;
            else groupBVotes++;
        }

        const totalConfirmedFromEvents = Object.values(confirmedByOracle).reduce((a, b) => a + b, 0);

        // Total Votes = all blockchain events (confirmed + unconfirmed), filtered by date/OLT
        const totalVotes = Object.values(votesByOracle).reduce((a, b) => a + b, 0);
        const confirmRate = totalVotes > 0 ? ((totalConfirmedFromEvents / totalVotes) * 100).toFixed(1) : '0.0';

        return {
            votesByOracle, confirmedByOracle,
            totalVotes, totalConfirmed: totalConfirmedFromEvents, confirmRate,
            confirmOp, confirmAlarm, confirmOffline,
            groupAVotes, groupBVotes,
        };
    }, [filtered]);

    const totalConsensus = stats.confirmOp + stats.confirmAlarm + stats.confirmOffline || 1;

    // Active filter label for subtitle
    const filterActive = oltFilter !== 'All' || startDate || endDate;

    return (
        <div className={styles.oraclePage}>

            {/* Filter active notice */}
            {filterActive && (
                <div className={styles.filterBanner}>
                    <span>🔍</span>
                    <span>
                        Filtered data —
                        {oltFilter !== 'All' ? ` OLT ${oltFilter}` : ' All OLTs'}
                        {startDate ? ` · from ${startDate}` : ''}
                        {endDate ? ` to ${endDate}` : ''}
                    </span>
                </div>
            )}

            {/* ── KPI CARDS ── */}
            <div className={styles.kpiRow}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Active Oracles</div>
                    <div className={styles.kpiValue} style={{ color: activeCount > 0 ? COL_GREEN : COL_GRAY }}>
                        {health.length ? activeCount : '—'}
                        <span className={styles.kpiOf}>/{ORACLE_COUNT}</span>
                    </div>
                    <div className={styles.kpiSub}>Live process check</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Total Votes Cast</div>
                    <div className={styles.kpiValue} style={{ color: COL_GREEN }}>{stats.totalVotes}</div>
                    <div className={styles.kpiSub}>{filterActive ? 'Filtered range' : 'All blockchain events'}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Confirmed On-Chain</div>
                    <div className={styles.kpiValue} style={{ color: COL_BLUE }}>{stats.totalConfirmed}</div>
                    <div className={styles.kpiSub}>Quorum reached</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Confirmation Rate</div>
                    <div className={styles.kpiValue} style={{ color: COL_GREEN }}>
                        {stats.confirmRate}<span className={styles.kpiOf}>%</span>
                    </div>
                    <div className={styles.kpiSub}>votes → on-chain</div>
                </div>
            </div>

            {/* ── MIDDLE ROW ── */}
            <div className={styles.midRow}>

                {/* Left: Consensus + Group Activity */}
                <div className="section-card" style={{ flex: '1', minWidth: 0 }}>
                    <div className="section-title">🔮 Consensus Distribution</div>

                    {[
                        { label: 'Operational', count: stats.confirmOp, color: COL_GREEN },
                        { label: 'Alarm', count: stats.confirmAlarm, color: COL_RED },
                        { label: 'Offline', count: stats.confirmOffline, color: COL_GRAY },
                    ].map(({ label, count, color }) => (
                        <div key={label} className={styles.consensusItem}>
                            <div className={styles.consensusLabel}>
                                <span style={{ color }}>● {label}</span>
                                <span className={styles.consensusCount}>
                                    {count} votes ({((count / totalConsensus) * 100).toFixed(0)}%)
                                </span>
                            </div>
                            <div className={styles.barTrack}>
                                <div className={styles.barFill} style={{ width: `${(count / totalConsensus) * 100}%`, background: color }} />
                            </div>
                        </div>
                    ))}

                    <div className="section-title" style={{ marginTop: '16px' }}>⚡ Group Activity</div>
                    {[
                        { label: 'Group A — OLT 1–10', votes: stats.groupAVotes, colorA: COL_GREEN, colorB: COL_BLUE },
                        { label: 'Group B — OLT 11–20', votes: stats.groupBVotes, colorA: COL_BLUE, colorB: '#a855f7' },
                    ].map(({ label, votes, colorA, colorB }) => (
                        <div key={label} className={styles.consensusItem}>
                            <div className={styles.consensusLabel}>
                                <span style={{ color: colorA }}>{label}</span>
                                <span className={styles.consensusCount}>{votes} votes</span>
                            </div>
                            <div className={styles.barTrack}>
                                <div
                                    className={styles.barFill}
                                    style={{
                                        width: `${stats.totalVotes > 0 ? (votes / stats.totalVotes) * 100 : 50}%`,
                                        background: `linear-gradient(90deg, ${colorA}, ${colorB})`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: Oracle Node Statistics Table */}
                <div className="section-card" style={{ flex: '2', minWidth: 0, overflow: 'hidden' }}>
                    <div className={styles.tableHeader}>
                        <div className="section-title" style={{ marginBottom: 0 }}>🔍 Oracle Node Statistics</div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Node</th>
                                    <th>Grp</th>
                                    <th>Process</th>
                                    <th>Uptime</th>
                                    <th>SNMP V3 Port</th>
                                    <th>Votes</th>
                                    <th>Confirmed</th>
                                    <th>Balance (IOTA)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: ORACLE_COUNT }, (_, i) => {
                                    const id = i + 1;
                                    const h = healthMap[id];
                                    const isActive = h?.status === 'active';
                                    const group = GROUP_A_IDS.includes(id) ? 'A' : 'B';

                                    return (
                                        <tr key={id} className={styles.tableRow}>
                                            <td className={styles.oracleIdCell}>Oracle-{id}</td>
                                            <td>
                                                <span className={styles.groupBadge} style={{ color: group === 'A' ? COL_GREEN : COL_BLUE }}>
                                                    {group}
                                                </span>
                                            </td>
                                            <td>
                                                {h ? (
                                                    <span className={isActive ? styles.statusActive : styles.statusOffline}>
                                                        {isActive ? '● Active' : '● Offline'}
                                                    </span>
                                                ) : (
                                                    <span className={styles.statusChecking}>◌ Checking…</span>
                                                )}
                                            </td>
                                            <td className={styles.numCell}>
                                                {isActive ? formatUptime(h?.uptime_sec ?? 0) : '—'}
                                            </td>
                                            <td className={styles.numCell}>
                                                {h ? (
                                                    <span style={{ color: isActive ? COL_GREEN : COL_GRAY }}>
                                                        :{h.snmp_port}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td className={styles.numCell}>{stats.votesByOracle[id] || 0}</td>
                                            <td className={styles.numCell}>{stats.confirmedByOracle[id] || 0}</td>
                                            <td className={styles.addrCell}>
                                                {h?.balance !== undefined ? (
                                                    <span style={{ color: COL_GREEN, fontWeight: 'bold' }}>{h.balance} Ɨ</span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
}
