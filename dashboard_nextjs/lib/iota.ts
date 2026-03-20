import { IotaClient, getFullnodeUrl } from '@iota/iota-sdk/client';

// =============================================
// CONFIGURATION (read from environment)
// =============================================
export const PACKAGE_ID = process.env.PACKAGE_ID || '';
export const REGISTRY_ID = process.env.REGISTRY_ID || '';
export const RPC_URL = process.env.RPC_URL || 'https://api.testnet.iota.cafe';
export const MODULE_NAME = process.env.MODULE_NAME || 'notarizer_v2';

let _oltObjectIds: Record<string, string> | null = null;
export function getOltObjectIds(): Record<string, string> {
    if (!_oltObjectIds) {
        try {
            _oltObjectIds = JSON.parse(process.env.OLT_OBJECT_IDS || '{}');
        } catch {
            _oltObjectIds = {};
        }
    }
    return _oltObjectIds!;
}

// =============================================
// SDK CLIENT SINGLETON
// =============================================
let _client: IotaClient | null = null;
export function getClient(): IotaClient {
    if (!_client) {
        _client = new IotaClient({ url: RPC_URL });
    }
    return _client;
}

// =============================================
// DATA TYPES
// =============================================
export type OltStatus = 0 | 1 | 2; // 0=Offline, 1=Operational, 2=Alarm

export interface OltState {
    oltId: string;
    status: OltStatus;
    groupId: number;
    lastValidator: string;
}

export interface OltEvent {
    date: string;
    datetime: number; // Unix ms timestamp
    oltId: string;
    status: OltStatus;
    oracleId: number;
    groupId: number;
    address: string;
    confirmed: boolean;
    proof: string;
    txDigest: string;
}

// =============================================
// FETCH LIVE OLT STATUS (via SDK multiGetObjects)
// =============================================
export async function fetchOltStatuses(): Promise<OltState[]> {
    const client = getClient();
    const oltIds = getOltObjectIds();
    const objectIds = Object.entries(oltIds)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([, v]) => v)
        .filter(Boolean);

    if (objectIds.length === 0) return [];

    try {
        const results = await client.multiGetObjects({
            ids: objectIds,
            options: { showContent: true },
        });

        const states: OltState[] = [];
        for (const obj of results) {
            if (obj.data?.content?.dataType !== 'moveObject') continue;
            const fields = obj.data.content.fields as Record<string, unknown>;
            const oltId = String(fields.olt_id ?? '');
            if (!oltId) continue;
            states.push({
                oltId,
                status: (parseInt(String(fields.status ?? '0')) as OltStatus),
                groupId: parseInt(String(fields.group_id ?? '0')),
                lastValidator: String(fields.last_validator ?? '0x0'),
            });
        }
        return states;
    } catch (err) {
        console.error('[IOTA SDK] fetchOltStatuses error:', err);
        return [];
    }
}

// =============================================
// FETCH EVENT HISTORY (via SDK queryEvents)
// =============================================
export async function fetchEventHistory(maxPages = 25): Promise<OltEvent[]> {
    const client = getClient();
    const events: OltEvent[] = [];
    let cursor: { txDigest: string; eventSeq: string } | null | undefined = undefined;

    try {
        for (let page = 0; page < maxPages; page++) {
            const result = await client.queryEvents({
                query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } },
                cursor: cursor ?? undefined,
                limit: 100,
                order: 'descending',
            });

            for (const item of result.data) {
                const ev = item.parsedJson as Record<string, unknown> | undefined;
                if (!ev || !('olt_id' in ev)) continue;

                // Priority: item.timestampMs (SDK Native) -> ev.timestamp (JSON) -> ev.time
                const rawTs = item.timestampMs || String(ev.timestamp ?? ev.time ?? Date.now());
                const ts = parseInt(rawTs);

                // If the TS is in seconds (10 digits), convert to ms for JS Date
                const finalTs = ts < 10000000000 ? ts * 1000 : ts;
                const dt = new Date(finalTs);
                const txDigest = item.id?.txDigest ?? '';

                events.push({
                    date: dt.toLocaleString('it-IT'),
                    datetime: dt.getTime(),
                    oltId: String(ev.olt_id),
                    status: (parseInt(String(ev.status ?? '0')) as OltStatus),
                    oracleId: parseInt(String(ev.virtual_oracle_id ?? '0')),
                    groupId: parseInt(String(ev.group_id ?? '0')),
                    address: String(ev.last_validator ?? ev.operator ?? ''),
                    confirmed: Boolean(ev.confirmed),
                    proof: txDigest
                        ? `https://explorer.iota.org/txblock/${txDigest}?network=testnet`
                        : '',
                    txDigest,
                });
            }

            if (!result.hasNextPage) break;
            cursor = result.nextCursor ?? null;
        }
    } catch (err) {
        console.error('[IOTA SDK] fetchEventHistory error:', err);
    }

    // Deduplicate: by txDigest only.
    // Events with the same txDigest are truly identical blockchain events.
    // The old secondary filter (oltId+status+address) has been removed because
    // it incorrectly discarded legitimate repeated state transitions notarized
    // by the same oracle at different timestamps.
    const seenProof = new Set<string>();
    const deduped: OltEvent[] = [];

    for (const e of events) {
        if (e.proof && seenProof.has(e.proof)) continue;
        if (e.proof) seenProof.add(e.proof);
        deduped.push(e);
    }

    return deduped.sort((a, b) => b.datetime - a.datetime);
}

// =============================================
// ITALY OLT COORDINATES
// =============================================
export const ITALY_COORDS: [number, number][] = [
    [45.46, 9.19],   // OLT 1  - Milano
    [45.07, 7.68],   // OLT 2  - Torino
    [45.43, 12.32],  // OLT 3  - Venezia
    [44.49, 11.34],  // OLT 4  - Bologna
    [44.40, 8.94],   // OLT 5  - Genova
    [43.76, 11.25],  // OLT 6  - Firenze
    [43.61, 13.51],  // OLT 7  - Ancona
    [43.11, 12.39],  // OLT 8  - Perugia
    [42.46, 14.21],  // OLT 9  - Pescara
    [41.89, 12.49],  // OLT 10 - Roma
    [41.11, 16.87],  // OLT 11 - Bari
    [40.85, 14.26],  // OLT 12 - Napoli
    [40.63, 15.80],  // OLT 13 - Potenza
    [40.91, 9.50],   // OLT 14 - Sassari
    [39.22, 9.12],   // OLT 15 - Cagliari
    [38.90, 16.60],  // OLT 16 - Catanzaro
    [38.11, 13.36],  // OLT 17 - Palermo
    [37.50, 15.08],  // OLT 18 - Catania
    [38.11, 15.64],  // OLT 19 - Messina
    [36.75, 14.85],  // OLT 20 - Ragusa
];
