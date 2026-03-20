import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getClient } from '@/lib/iota';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORACLE_COUNT = 10;
const HEALTH_BASE_PORT = 6000; // Oracle-N listens on 6000+N
const TIMEOUT_MS = 800;

export interface OracleHealth {
    oracle_id: number;
    status: 'active' | 'offline';
    snmp_port: number;
    health_port: number;
    address: string;
    uptime_sec: number;
    total_votes: number;
    timestamp: number;
    response_ms: number;
    balance: string;
}

import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';

// Derived addresses from ORACLE_KEYS
let _memoizedAddresses: string[] | null = null;
function getOracleAddresses(): string[] {
    if (_memoizedAddresses) return _memoizedAddresses;

    const envKeys = process.env.ORACLE_KEYS;
    if (!envKeys) return [];

    try {
        const keysMap = JSON.parse(envKeys);
        const addresses: string[] = [];
        for (let i = 1; i <= ORACLE_COUNT; i++) {
            const privKey = keysMap[i.toString()];
            if (privKey) {
                const kp = Ed25519Keypair.fromSecretKey(privKey);
                addresses.push(kp.getPublicKey().toIotaAddress());
            } else {
                addresses.push('');
            }
        }
        _memoizedAddresses = addresses;
        return addresses;
    } catch {
        return [];
    }
}

async function pingOracle(id: number, walletAddress: string): Promise<OracleHealth> {
    const healthPort = HEALTH_BASE_PORT + id;
    const snmpPort = 5004 + id; // Oracle 1→5005, 2→5006, etc.
    const start = Date.now();

    const offline: OracleHealth = {
        oracle_id: id,
        status: 'offline',
        snmp_port: snmpPort,
        health_port: healthPort,
        address: walletAddress,   // always populated from wallets file
        uptime_sec: 0,
        total_votes: 0,
        timestamp: Date.now(),
        response_ms: 0,
        balance: '0',
    };

    let pBalance = '0';
    try {
        if (walletAddress) {
            const coin = await getClient().getBalance({ owner: walletAddress });
            pBalance = (Number(coin.totalBalance) / 1_000_000_000).toFixed(2);
        }
    } catch {
        // ignore balance fetch err
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(`http://127.0.0.1:${healthPort}`, {
            signal: controller.signal,
            cache: 'no-store',
        });
        clearTimeout(timer);

        if (!res.ok) return offline;

        const data = await res.json();
        return {
            oracle_id: id,
            status: 'active',
            snmp_port: data.snmp_port ?? snmpPort,
            health_port: healthPort,
            // prefer the address from the running process, fallback to wallet file
            address: data.address ?? walletAddress,
            uptime_sec: data.uptime_sec ?? 0,
            total_votes: data.total_votes ?? 0,
            timestamp: data.timestamp ?? Date.now(),
            response_ms: Date.now() - start,
            balance: pBalance,
        };
    } catch {
        return { ...offline, response_ms: Date.now() - start, balance: pBalance };
    }
}

export async function GET() {
    const wallets = getOracleAddresses();

    const results = await Promise.all(
        Array.from({ length: ORACLE_COUNT }, (_, i) => {
            const id = i + 1;
            const addr = wallets[i] ?? '';
            return pingOracle(id, addr);
        })
    );

    return NextResponse.json({ oracles: results, checkedAt: Date.now() });
}
