'use client';

import { OltState, OltStatus } from '@/lib/iota';
import styles from './OltGrid.module.css';

interface Props {
    statuses: OltState[];
    statusMap: Record<string, OltStatus>;
    groupMap: Record<string, number>;
    lastOracleMap: Record<string, number>;
}

const STATUS_LABEL: Record<OltStatus, string> = {
    1: 'OPERATIONAL',
    2: 'ALARM',
    0: 'OFFLINE',
};

const STATUS_CLASS: Record<OltStatus, string> = {
    1: styles.operational,
    2: styles.alarm,
    0: styles.offline,
};

const STATUS_EMOJI: Record<OltStatus, string> = {
    1: '🟢',
    2: '🔴',
    0: '⚫',
};

export default function OltGrid({ statusMap, groupMap, lastOracleMap }: Props) {
    const rows = [[1, 10], [11, 20]];

    return (
        <div className={styles.wrapper}>
            {rows.map(([from, to]) => (
                <div key={from} className={styles.row}>
                    {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((id) => {
                        const oid = String(id);
                        const status = statusMap[oid] ?? 0;
                        const group = groupMap[oid] ?? (id <= 10 ? 1 : 2);
                        const oId = lastOracleMap[oid] ?? '?';

                        return (
                            <div key={oid} className={`${styles.card} ${STATUS_CLASS[status as OltStatus]}`}>
                                <div className={styles.oltId}>OLT {oid}</div>
                                <div className={`${styles.groupBadge} ${group === 1 ? styles.grp1 : styles.grp2}`}>
                                    GRP {group}
                                </div>
                                <div className={styles.emoji}>{STATUS_EMOJI[status as OltStatus]}</div>
                                <div className={styles.statusLabel}>{STATUS_LABEL[status as OltStatus]}</div>
                                <div className={styles.oracleLabel}>Oracle {oId}</div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
