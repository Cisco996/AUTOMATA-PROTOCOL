import { NextResponse } from 'next/server';
import { fetchOltStatuses, fetchEventHistory } from '@/lib/iota';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const [statuses, events] = await Promise.all([
            fetchOltStatuses(),
            fetchEventHistory(25),
        ]);

        return NextResponse.json({ statuses, events });
    } catch (err) {
        console.error('[API] /api/dashboard error:', err);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
