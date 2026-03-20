import { spawn, ChildProcess } from 'child_process';
const snmp = require('net-snmp');
import * as fs from 'fs';
import * as path from 'path';

// Simulation Configuration
const ORACLE_COUNT = 10;
const OLT_COUNT = 20;
const SNMP_IP = "127.0.0.1";

// SNMP V3 Credentials
const SNMP_USER = {
    name: "olt_user",
    level: snmp.SecurityLevel.authPriv,
    authProtocol: snmp.AuthProtocols.sha,
    authKey: "auth12345",
    privProtocol: snmp.PrivProtocols.aes,
    privKey: "priv12345"
};

const OID_OLT_ID = "1.3.6.1.4.1.2021.100.1";
const OID_STATUS = "1.3.6.1.4.1.2021.100.2";
const OID_TIMESTAMP = "1.3.6.1.4.1.2021.100.3";
const OID_LINK_UP = "1.3.6.1.6.3.1.1.5.4";

interface OltState {
    id: number;
    status: number;
    active: boolean;
}

interface OracleState {
    id: number;
    pid: number | null;
    process: ChildProcess | null;
    active: boolean;
}

class SimulationManager {
    private olts: Map<number, OltState> = new Map();
    private oracles: Map<number, OracleState> = new Map();
    private oltInterval: NodeJS.Timeout | null = null;
    private snmpSessions: Map<number, any> = new Map();

    constructor() {
        console.log("🛠️ SimulationManager initialized (SNMP V3 Mode)");
        for (let i = 1; i <= OLT_COUNT; i++) {
            this.olts.set(i, { id: i, status: 1, active: false });
        }
        for (let i = 1; i <= ORACLE_COUNT; i++) {
            this.oracles.set(i, { id: i, pid: null, process: null, active: false });
        }
    }

    public async startAll() {
        const logFile = path.join(process.cwd(), 'logs', 'simulation_manager.log');
        const log = (msg: string) => {
            const time = new Date().toLocaleTimeString();
            if (!fs.existsSync(path.dirname(logFile))) fs.mkdirSync(path.dirname(logFile), { recursive: true });
            fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
            console.log(msg);
        };

        log("🚀 Starting complete simulation (SNMP V3)...");
        try {
            this.snmpSessions.clear();
            await this.startOracles();
            log("✅ Oracles started. Waiting 5 seconds for readiness...");
            await new Promise(r => setTimeout(r, 5000));
            this.startOlts();
            log("✅ OLT simulation started.");
        } catch (err: any) {
            log(`❌ CRITICAL ERROR in startAll: ${err.message}`);
            log(err.stack);
        }
    }

    public async startOracles() {
        // Find listener (looking in root and local)
        const rootDir = path.resolve(process.cwd(), '..');
        const listenerPath = fs.existsSync(path.join(process.cwd(), 'oracle_listener.js'))
            ? path.join(process.cwd(), 'oracle_listener.js')
            : path.join(rootDir, 'oracle_listener.js');

        const envKeys = process.env.ORACLE_KEYS;
        if (!envKeys) {
            console.error("❌ ORACLE_KEYS not found in environment.");
            return;
        }

        let keys: Record<string, string>;
        try {
            keys = JSON.parse(envKeys);
        } catch (e) {
            console.error("❌ Failed to parse ORACLE_KEYS JSON.");
            return;
        }

        for (let i = 0; i < ORACLE_COUNT; i++) {
            const id = i + 1;
            if (this.oracles.get(id)?.active) continue;

            const port = 5005 + i;
            const privKey = keys[id.toString()];

            if (!privKey) {
                console.warn(`[!] No key found for Oracle-${id} in ORACLE_KEYS. Skipping.`);
                continue;
            }

            console.log(`[*] Launching Oracle-${id} (SNMP V3 Port: ${port})...`);

            // Use process.execPath for better Windows reliability
            const proc = spawn(process.execPath, [listenerPath, id.toString(), port.toString(), privKey], {
                detached: false,
                stdio: 'ignore',
                env: process.env
            });

            this.oracles.set(id, {
                id,
                pid: proc.pid || null,
                process: proc,
                active: true
            });

            proc.on('close', (code) => {
                console.log(`Oracle-${id} stopped with code ${code}`);
                this.oracles.set(id, { id, pid: null, process: null, active: false });
            });

            await new Promise(r => setTimeout(r, 300));
        }
    }

    private startOlts() {
        if (this.oltInterval) return;

        // Set all to active and status 1
        for (let i = 1; i <= OLT_COUNT; i++) {
            this.olts.set(i, { id: i, status: 1, active: true });
        }

        this.oltInterval = setInterval(() => {
            this.olts.forEach(olt => {
                if (olt.active) {
                    this.sendOltUpdate(olt.id, olt.status);
                }
            });
        }, 60000); // 1 minute

        // Immediate first heartbeat
        this.olts.forEach(olt => this.sendOltUpdate(olt.id, olt.status));
    }

    private sendOltUpdate(oltId: number, status: number) {
        const ports = oltId <= 10 ? [5005, 5006, 5007, 5008, 5009] : [5010, 5011, 5012, 5013, 5014];
        const timestamp = Math.floor(Date.now() / 1000);

        const varbinds = [
            { oid: OID_OLT_ID, type: snmp.ObjectType.Integer, value: oltId },
            { oid: OID_STATUS, type: snmp.ObjectType.Integer, value: status },
            { oid: OID_TIMESTAMP, type: snmp.ObjectType.Unsigned32, value: timestamp }
        ];

        ports.forEach(port => {
            try {
                if (!this.snmpSessions.has(port)) {
                    this.snmpSessions.set(port, snmp.createV3Session(SNMP_IP, SNMP_USER, { trapPort: port }));
                }
                const session = this.snmpSessions.get(port);
                session.trap(OID_LINK_UP, varbinds, (err: any) => {
                    if (err) {
                        const errMsg = `[${new Date().toLocaleTimeString()}] SNMP Trap Error OLT-${oltId} to Port ${port}: ${err.message || err}\n`;
                        fs.appendFileSync(path.join(process.cwd(), 'logs', 'simulation_manager.log'), errMsg);
                        this.snmpSessions.delete(port); // Force recreation on next attempt
                    }
                });
            } catch (e: any) {
                const errMsg = `[${new Date().toLocaleTimeString()}] Failed to send SNMP update to port ${port}: ${e.message || e}\n`;
                fs.appendFileSync(path.join(process.cwd(), 'logs', 'simulation_manager.log'), errMsg);
            }
        });
    }

    public setRandomAlarm(count: number = 1) {
        let activeIds = Array.from(this.olts.values())
            .filter(o => o.active && o.status === 1)
            .map(o => o.id);

        const toAlarm = activeIds.sort(() => 0.5 - Math.random()).slice(0, count);

        toAlarm.forEach(id => {
            const olt = this.olts.get(id);
            if (olt) {
                olt.status = 2; // Alarm
                this.olts.set(id, olt);
                this.sendOltUpdate(olt.id, olt.status);
            }
        });

        if (toAlarm.length > 0) {
            console.log(`⚠️ Set ${toAlarm.length} OLTs to ALARM status: ${toAlarm.join(', ')}`);
        }
    }

    public stopRandomOlts(count: number) {
        const activeIds = Array.from(this.olts.values())
            .filter(o => o.active)
            .map(o => o.id);

        const toStop = activeIds.sort(() => 0.5 - Math.random()).slice(0, count);
        toStop.forEach(id => {
            const olt = this.olts.get(id);
            if (olt) {
                olt.active = false;
                olt.status = 0; // Simulated offline
                this.olts.set(id, olt);
            }
        });
        console.log(`🛑 Stopped ${toStop.length} random OLTs: ${toStop.join(', ')}`);
    }

    public resetOlts() {
        for (let i = 1; i <= OLT_COUNT; i++) {
            this.olts.set(i, { id: i, status: 1, active: true });
        }
        console.log("🔄 All OLTs reset to Operational");
        // Trigger immediate heartbeat
        this.olts.forEach(olt => this.sendOltUpdate(olt.id, olt.status));
    }

    public stopOracleA() {
        // Group A is Oracles 1-5
        const groupA = Array.from(this.oracles.values())
            .filter(o => o.id <= 5 && o.active);

        if (groupA.length > 0) {
            const randomOracle = groupA[Math.floor(Math.random() * groupA.length)];
            console.log(`🛑 Stopping Oracle-${randomOracle.id} (PID: ${randomOracle.pid})`);
            if (randomOracle.process) {
                randomOracle.process.kill();
            }
        }
    }

    public stopOracleB() {
        // Group B is Oracles 6-10
        const groupB = Array.from(this.oracles.values())
            .filter(o => o.id > 5 && o.active);

        if (groupB.length > 0) {
            const randomOracle = groupB[Math.floor(Math.random() * groupB.length)];
            console.log(`🛑 Stopping Oracle-${randomOracle.id} (PID: ${randomOracle.pid})`);
            if (randomOracle.process) {
                randomOracle.process.kill();
            }
        }
    }

    public getStatus() {
        return {
            olts: Array.from(this.olts.values()).map(o => ({ id: o.id, status: o.status, active: o.active })),
            oracles: Array.from(this.oracles.values()).map(o => ({ id: o.id, active: o.active })),
            isRunning: !!this.oltInterval
        };
    }
}

// Global singleton pattern for Next.js dev mode
const globalForSimulation = global as unknown as { simulationManager: SimulationManager };
export const simulationManager = globalForSimulation.simulationManager || new SimulationManager();
if (process.env.NODE_ENV !== 'production') globalForSimulation.simulationManager = simulationManager;
