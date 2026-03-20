"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITALY_COORDS = exports.MODULE_NAME = exports.RPC_URL = exports.REGISTRY_ID = exports.PACKAGE_ID = void 0;
exports.getOltObjectIds = getOltObjectIds;
exports.getClient = getClient;
exports.fetchOltStatuses = fetchOltStatuses;
exports.fetchEventHistory = fetchEventHistory;
const client_1 = require("@iota/iota-sdk/client");
// =============================================
// CONFIGURATION (read from environment)
// =============================================
exports.PACKAGE_ID = process.env.PACKAGE_ID || '';
exports.REGISTRY_ID = process.env.REGISTRY_ID || '';
exports.RPC_URL = process.env.RPC_URL || 'https://api.testnet.iota.cafe';
exports.MODULE_NAME = process.env.MODULE_NAME || 'notarizer_v2';
let _oltObjectIds = null;
function getOltObjectIds() {
    if (!_oltObjectIds) {
        try {
            _oltObjectIds = JSON.parse(process.env.OLT_OBJECT_IDS || '{}');
        }
        catch {
            _oltObjectIds = {};
        }
    }
    return _oltObjectIds;
}
// =============================================
// SDK CLIENT SINGLETON
// =============================================
let _client = null;
function getClient() {
    if (!_client) {
        _client = new client_1.IotaClient({ url: exports.RPC_URL });
    }
    return _client;
}
// =============================================
// FETCH LIVE OLT STATUS (via SDK multiGetObjects)
// =============================================
async function fetchOltStatuses() {
    const client = getClient();
    const oltIds = getOltObjectIds();
    const objectIds = Object.entries(oltIds)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([, v]) => v)
        .filter(Boolean);
    if (objectIds.length === 0)
        return [];
    try {
        const results = await client.multiGetObjects({
            ids: objectIds,
            options: { showContent: true },
        });
        const states = [];
        for (const obj of results) {
            if (obj.data?.content?.dataType !== 'moveObject')
                continue;
            const fields = obj.data.content.fields;
            const oltId = String(fields.olt_id ?? '');
            if (!oltId)
                continue;
            states.push({
                oltId,
                status: parseInt(String(fields.status ?? '0')),
                groupId: parseInt(String(fields.group_id ?? '0')),
                lastValidator: String(fields.last_validator ?? '0x0'),
            });
        }
        return states;
    }
    catch (err) {
        console.error('[IOTA SDK] fetchOltStatuses error:', err);
        return [];
    }
}
// =============================================
// FETCH EVENT HISTORY (via SDK queryEvents)
// =============================================
async function fetchEventHistory(maxPages = 25) {
    const client = getClient();
    const events = [];
    let cursor = undefined;
    try {
        for (let page = 0; page < maxPages; page++) {
            const result = await client.queryEvents({
                query: { MoveModule: { package: exports.PACKAGE_ID, module: exports.MODULE_NAME } },
                cursor: cursor ?? undefined,
                limit: 100,
                order: 'descending',
            });
            for (const item of result.data) {
                const ev = item.parsedJson;
                if (!ev || !('olt_id' in ev))
                    continue;
                const ts = parseInt(String(ev.timestamp ?? ev.time ?? '0'));
                if (ts === 0)
                    continue;
                const dt = new Date(ts * 1000);
                const txDigest = item.id?.txDigest ?? '';
                events.push({
                    date: dt.toLocaleString('it-IT'),
                    datetime: dt.getTime(),
                    oltId: String(ev.olt_id),
                    status: parseInt(String(ev.status ?? '0')),
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
            if (!result.hasNextPage)
                break;
            cursor = result.nextCursor ?? null;
        }
    }
    catch (err) {
        console.error('[IOTA SDK] fetchEventHistory error:', err);
    }
    // Deduplicate: by proof, then by [oltId+status+address]
    const seenProof = new Set();
    const seenCombo = new Set();
    const deduped = [];
    for (const e of events) {
        if (e.proof && seenProof.has(e.proof))
            continue;
        const combo = `${e.oltId}-${e.status}-${e.address}`;
        if (seenCombo.has(combo))
            continue;
        if (e.proof)
            seenProof.add(e.proof);
        seenCombo.add(combo);
        deduped.push(e);
    }
    return deduped.sort((a, b) => b.datetime - a.datetime);
}
// =============================================
// ITALY OLT COORDINATES
// =============================================
exports.ITALY_COORDS = [
    [45.46, 9.19], // OLT 1  - Milano
    [45.07, 7.68], // OLT 2  - Torino
    [45.43, 12.32], // OLT 3  - Venezia
    [44.49, 11.34], // OLT 4  - Bologna
    [44.40, 8.94], // OLT 5  - Genova
    [43.76, 11.25], // OLT 6  - Firenze
    [43.61, 13.51], // OLT 7  - Ancona
    [43.11, 12.39], // OLT 8  - Perugia
    [42.46, 14.21], // OLT 9  - Pescara
    [41.89, 12.49], // OLT 10 - Roma
    [41.11, 16.87], // OLT 11 - Bari
    [40.85, 14.26], // OLT 12 - Napoli
    [40.63, 15.80], // OLT 13 - Potenza
    [40.91, 9.50], // OLT 14 - Sassari
    [39.22, 9.12], // OLT 15 - Cagliari
    [38.90, 16.60], // OLT 16 - Catanzaro
    [38.11, 13.36], // OLT 17 - Palermo
    [37.50, 15.08], // OLT 18 - Catania
    [38.11, 15.64], // OLT 19 - Messina
    [36.75, 14.85], // OLT 20 - Ragusa
];
