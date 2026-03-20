'use client';

import { OltEvent } from '@/lib/iota';
import styles from './AuditLog.module.css';

interface Props {
    events: OltEvent[];
    startDate: string;
    endDate: string;
    oltFilter: string;
}

const STATUS_LABEL: Record<number, string> = {
    1: '🟢 Operational',
    2: '🔴 Alarm',
    0: '⚫ Offline',
};

export default function AuditLog({ events, startDate, endDate, oltFilter }: Props) {
    const startMs = new Date(startDate + 'T00:00:00').getTime();
    const endMs = new Date(endDate + 'T23:59:59').getTime();

    let filtered = events.filter(
        e => e.confirmed && e.datetime >= startMs && e.datetime <= endMs
    );
    if (oltFilter !== 'All') filtered = filtered.filter(e => e.oltId === oltFilter);
    filtered = filtered.sort((a, b) => b.datetime - a.datetime);

    if (filtered.length === 0) {
        return (
            <div className={styles.empty}>No confirmed notarizations for the selected filters.</div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>OLT ID</th>
                        <th>Status</th>
                        <th>Validator ID</th>
                        <th>Blockchain Proof</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((ev, i) => (
                        <tr key={i} className={styles.row}>
                            <td className={styles.date}>{ev.date}</td>
                            <td className={styles.id}>OLT {ev.oltId}</td>
                            <td>
                                <span className={styles[`status${ev.status}`]}>
                                    {STATUS_LABEL[ev.status]}
                                </span>
                            </td>
                            <td className={styles.oracle}>#{ev.oracleId}</td>
                            <td>
                                {ev.proof ? (
                                    <a
                                        href={ev.proof}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.proofLink}
                                    >
                                        🔗 Verify on Explorer
                                    </a>
                                ) : (
                                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
