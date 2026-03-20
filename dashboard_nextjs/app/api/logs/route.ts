import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        // List all logs
        try {
            const logsDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) return NextResponse.json([]);
            const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
            return NextResponse.json(files);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to list logs' }, { status: 500 });
        }
    }

    // Serve specific log
    try {
        const filePath = path.join(process.cwd(), 'logs', `oracle_ts_${id}.log`);
        if (!fs.existsSync(filePath)) {
            return new Response('Log not found', { status: 404 });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return new Response(content, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (e) {
        return new Response('Error reading log', { status: 500 });
    }
}
