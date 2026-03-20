'use client';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { OltEvent, OltStatus } from '@/lib/iota';
import { useMemo } from 'react';
import styles from './StatusChart.module.css';

interface Props {
    events: OltEvent[];
    startDate: string;
    endDate: string;
    oltFilter: string;
}

const STATUS_LABELS: Record<OltStatus, string> = {
    1: 'Operational',
    2: 'Alarm',
    0: 'Offline',
};

const STATUS_COLORS: Record<string, string> = {
    'Operational': '#00e054', // Vibrant Green
    'Alarm': '#ff3131',       // Cyber Red
    'Offline': '#666666',      // Gray
};

const STATUS_ORDER = ['Operational', 'Offline', 'Alarm'];

function calcDurations(events: OltEvent[], startDate: string, endDate: string, oltFilter: string) {
    const now = Date.now();
    const startMs = new Date(startDate + 'T00:00:00').getTime();
    const endMs = Math.min(new Date(endDate + 'T23:59:59').getTime(), now);

    // Filter by date and OLT
    let filtered = events.filter(e => e.confirmed && e.datetime >= startMs && e.datetime <= endMs);
    if (oltFilter !== 'All') filtered = filtered.filter(e => e.oltId === oltFilter);

    // Group by OLT
    const byOlt: Record<string, OltEvent[]> = {};
    for (const e of filtered) {
        if (!byOlt[e.oltId]) byOlt[e.oltId] = [];
        byOlt[e.oltId].push(e);
    }

    // Calculate duration per state per OLT
    const chartData: Record<string, Record<string, number>> = {};

    for (let i = 1; i <= 20; i++) {
        const oid = String(i);
        chartData[oid] = { 'Operational': 0, 'Alarm': 0, 'Offline': 0 };

        const oltEvents = (byOlt[oid] || []).sort((a, b) => a.datetime - b.datetime);
        let prevTime: number | null = null;
        let prevStatus: OltStatus | null = null;

        for (const ev of oltEvents) {
            if (prevTime !== null && prevStatus !== null) {
                const durationMin = (ev.datetime - prevTime) / 60000;
                const label = STATUS_LABELS[prevStatus];
                chartData[oid][label] = (chartData[oid][label] || 0) + durationMin;
            }
            prevTime = ev.datetime;
            prevStatus = ev.status;
        }

        // Last known state until now / end
        if (prevTime !== null && prevStatus !== null) {
            const durationMin = (endMs - prevTime) / 60000;
            const label = STATUS_LABELS[prevStatus];
            chartData[oid][label] = (chartData[oid][label] || 0) + durationMin;
        }
    }

    return Object.entries(chartData)
        .filter(([, v]) => Object.values(v).some(d => d > 0))
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([olt, data]) => ({ olt: `OLT ${olt}`, ...data }));
}

export default function StatusChart({ events, startDate, endDate, oltFilter }: Props) {
    const data = useMemo(
        () => calcDurations(events, startDate, endDate, oltFilter),
        [events, startDate, endDate, oltFilter]
    );

    if (data.length === 0) {
        return (
            <div className={styles.empty}>No data available for the selected filters.</div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,200,0.07)" />
                    <XAxis
                        dataKey="olt"
                        tick={{ fill: '#7ecec8', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(0,255,200,0.2)' }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: '#7ecec8', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(0,255,200,0.2)' }}
                        tickLine={false}
                        label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: '#7ecec8', fontSize: 10 }}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'rgba(5,15,30,0.95)',
                            border: '1px solid rgba(0,255,200,0.3)',
                            borderRadius: '8px',
                            color: '#cff',
                            fontSize: '12px',
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [`${(Number(value) || 0).toFixed(1)} min`, String(name ?? '')]}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', color: '#7ecec8' }}
                    />
                    {STATUS_ORDER.map(key => (
                        <Bar
                            key={key}
                            dataKey={key}
                            stackId="stack"
                            fill={STATUS_COLORS[key]}
                            radius={undefined}
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
