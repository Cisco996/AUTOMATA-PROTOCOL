import { NextResponse } from 'next/server';
import { simulationManager } from '@/lib/simulation_manager';

export async function GET() {
    return NextResponse.json(simulationManager.getStatus());
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, payload } = body;

        switch (action) {
            case 'START_ALL':
                await simulationManager.startAll();
                break;
            case 'STOP_RANDOM_OLTS':
                simulationManager.stopRandomOlts(payload?.count || 1);
                break;
            case 'SET_RANDOM_ALARM':
                simulationManager.setRandomAlarm(payload?.count || 1);
                break;
            case 'RESET_OLTS':
                simulationManager.resetOlts();
                break;
            case 'STOP_ORACLE_A':
                simulationManager.stopOracleA();
                break;
            case 'STOP_ORACLE_B':
                simulationManager.stopOracleB();
                break;
            case 'RESTART_ORACLES':
                await simulationManager.startOracles();
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, status: simulationManager.getStatus() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
