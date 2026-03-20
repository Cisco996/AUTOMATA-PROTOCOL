"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@iota/iota-sdk/client");
const ed25519_1 = require("@iota/iota-sdk/keypairs/ed25519");
const transactions_1 = require("@iota/iota-sdk/transactions");
const dotenv = __importStar(require("dotenv"));
const snmp = require('net-snmp');
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv.config();
// =============================================
// CONFIGURATION
// =============================================
const PACKAGE_ID = process.env.PACKAGE_ID || "";
const REGISTRY_ID = process.env.REGISTRY_ID || "";
const RPC_URL = process.env.RPC_URL || "https://api.testnet.iota.cafe";
const TIMEOUT_LIMIT = parseInt(process.env.TIMEOUT_LIMIT || "70");
const OLT_OBJECT_IDS = JSON.parse(process.env.OLT_OBJECT_IDS || "{}");
// SNMP V3 Simulation Credentials (must match simulation_manager)
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
class OracleListener {
    constructor(oracleId, port, privateKeyBase64) {
        this.startedAt = Date.now();
        this.totalVotes = 0;
        this.oltRegistry = new Map();
        this.voteQueue = [];
        this.isProcessingQueue = false;
        this.oracleId = oracleId;
        this.port = port;
        this.healthPort = 6000 + oracleId;
        this.client = new client_1.IotaClient({ url: RPC_URL });
        this.keypair = ed25519_1.Ed25519Keypair.fromSecretKey(privateKeyBase64);
        if (!fs.existsSync('logs'))
            fs.mkdirSync('logs');
        const logFile = path.join('logs', `oracle_ts_${this.oracleId}.log`);
        this.log = (msg) => {
            // Force 24-hour format HH:mm:ss for consistent logging
            const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
            const logMsg = `[${time}] [Oracle-${this.oracleId}] ${msg}`;
            console.log(logMsg);
            fs.appendFileSync(logFile, logMsg + '\n');
        };
        this.log(`📡 SNMP V3 Initialized at address: ${this.keypair.getPublicKey().toIotaAddress()}`);
    }
    async start() {
        this.log(`--- ORACLE-${this.oracleId} STARTED (SNMP V3 MODE) ---`);
        // ── SNMP V3 Receiver ──
        const options = {
            port: this.port,
            disableAuthorization: false
        };
        const receiver = snmp.createReceiver(options, (err, trap) => {
            if (err) {
                this.log(`SNMP Error: ${err}`);
            }
            else {
                this.handleSnmpTrap(trap);
            }
        });
        receiver.getAuthorizer().addUser(SNMP_USER);
        this.log(`Listening for SNMP V3 AuthPriv Traps on port ${this.port}`);
        // ── HTTP Health-Check Server ──
        const address = this.keypair.getPublicKey().toIotaAddress();
        const healthServer = http.createServer((_req, res) => {
            const uptimeSec = Math.floor((Date.now() - this.startedAt) / 1000);
            const payload = JSON.stringify({
                oracle_id: this.oracleId,
                status: 'active',
                snmp_port: this.port,
                address,
                uptime_sec: uptimeSec,
                total_votes: this.totalVotes,
                timestamp: Date.now(),
            });
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(payload);
        });
        healthServer.listen(this.healthPort, '127.0.0.1', () => {
            this.log(`Health-check HTTP server listening on port ${this.healthPort}`);
        });
        const managedRange = this.oracleId <= 5 ?
            Array.from({ length: 10 }, (_, i) => i + 1) :
            Array.from({ length: 10 }, (_, i) => i + 11);
        managedRange.forEach(id => {
            this.oltRegistry.set(id.toString(), { currentStatus: "0", lastSeen: Date.now() });
        });
        setInterval(() => this.checkTimeouts(), 10000);
    }
    handleSnmpTrap(trap) {
        try {
            const varbinds = trap.pdu.varbinds;
            // this.log(`Received SNMP Notification with ${varbinds.length} varbinds`);
            let oidInt = 0;
            let status = "0";
            for (const vb of varbinds) {
                // this.log(`  VB: ${vb.oid} = ${vb.value}`);
                if (vb.oid === OID_OLT_ID)
                    oidInt = vb.value;
                if (vb.oid === OID_STATUS)
                    status = String(vb.value);
            }
            if (!oidInt)
                return;
            const isGroupA = this.oracleId <= 5;
            if ((isGroupA && oidInt > 10) || (!isGroupA && oidInt <= 10))
                return;
            const oid = String(oidInt);
            const entry = this.oltRegistry.get(oid);
            if (!entry) {
                this.oltRegistry.set(oid, { currentStatus: status, lastSeen: Date.now() });
                this.addToVoteQueue(oidInt, status);
            }
            else {
                if (entry.currentStatus !== status) {
                    entry.currentStatus = status;
                    this.addToVoteQueue(oidInt, status);
                }
                entry.lastSeen = Date.now();
            }
        }
        catch (e) {
            this.log(`SNMP Trap Process Error: ${e}`);
        }
    }
    addToVoteQueue(oltId, status, originalTimestamp, retryCount = 0) {
        this.voteQueue.push({
            oltId,
            status,
            timestamp: originalTimestamp ?? Math.floor(Date.now() / 1000),
            retryCount
        });
        this.processQueue();
    }
    async processQueue() {
        if (this.isProcessingQueue || this.voteQueue.length === 0)
            return;
        this.isProcessingQueue = true;
        while (this.voteQueue.length > 0) {
            const item = this.voteQueue.shift();
            await this.executeVote(item);
            if (this.voteQueue.length > 0) {
                await new Promise(r => setTimeout(r, 50));
            }
        }
        this.isProcessingQueue = false;
    }
    async executeVote(item) {
        const oltObjId = OLT_OBJECT_IDS[item.oltId.toString()];
        if (!oltObjId)
            return;
        this.log(`>>> VOTE OLT ${item.oltId} -> ${item.status}`);
        this.totalVotes++;
        const txb = new transactions_1.Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::notarizer_v2::notarize_parallel`,
            arguments: [
                txb.object(REGISTRY_ID),
                txb.object(oltObjId),
                txb.pure.u8(parseInt(item.status)),
                txb.pure.u64(item.timestamp),
                txb.pure.u64(this.oracleId)
            ]
        });
        try {
            // Gas budget estimation and allocation are handled automatically by the SDK
            // We pass showInput: true so we can read the allocated budget in the response
            const result = await this.client.signAndExecuteTransaction({
                signer: this.keypair,
                transaction: txb,
                options: {
                    showEffects: true,
                    showInput: true
                }
            });
            // Extract automatically assigned budget and actual spent gas
            let gasBudget = "unknown";
            let gasSpent = "unknown";
            if (result.transaction?.data?.gasData?.budget) {
                gasBudget = result.transaction.data.gasData.budget;
            }
            if (result.effects?.gasUsed) {
                const g = result.effects.gasUsed;
                const netStorage = BigInt(g.storageCost) - BigInt(g.storageRebate);
                const actualGas = BigInt(g.computationCost) + (netStorage > 0n ? netStorage : 0n);
                gasSpent = actualGas.toString();
            }
            this.log(`    [GAS] budget=${gasBudget} | spent=${gasSpent}`);
            if (result.effects?.status.status === 'success') {
                this.log(`    [OK] Notarized.`);
            }
            else {
                this.handleExecutionError(result.effects?.status.error || 'Unknown Error', item);
            }
        }
        catch (err) {
            this.handleExecutionError(err.message, item);
        }
    }
    handleExecutionError(error, item) {
        if (error.includes('1') || error.includes('EAlreadyVoted')) {
            this.log(`    [INFO] Already registered.`);
        }
        else if (error.includes('4') || error.includes('EStateAlreadyReached')) {
            this.log(`    [INFO] Quorum already reached. Skipping.`);
        }
        else {
            const MAX_RETRIES = 3;
            const nextRetry = (item.retryCount ?? 0) + 1;
            if (nextRetry > MAX_RETRIES) {
                this.log(`    [DEAD] OLT-${item.oltId} vote permanently failed after ${MAX_RETRIES} retries. Dropping.`);
                return;
            }
            setTimeout(() => {
                const current = this.oltRegistry.get(String(item.oltId));
                if (current && current.currentStatus === item.status) {
                    this.log(`    [RETRY ${nextRetry}/${MAX_RETRIES}] OLT-${item.oltId} status=${item.status} (original ts: ${item.timestamp})`);
                    this.addToVoteQueue(item.oltId, item.status, item.timestamp, nextRetry);
                }
                else {
                    this.log(`    [SKIP] Retry aborted: OLT-${item.oltId} state changed to ${current?.currentStatus ?? 'unknown'}. Dropping stale vote.`);
                }
            }, 5000 + Math.random() * 5000);
        }
    }
    checkTimeouts() {
        const now = Date.now();
        for (const [oid, data] of this.oltRegistry.entries()) {
            if (now - data.lastSeen > TIMEOUT_LIMIT * 1000 && data.currentStatus !== "0") {
                this.log(`TIMEOUT: OLT ${oid}`);
                data.currentStatus = "0";
                this.addToVoteQueue(parseInt(oid), "0");
            }
        }
    }
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const oracleId = parseInt(args[0] || "1");
    const port = parseInt(args[1] || "5005");
    const privKey = args[2] || "";
    if (!privKey) {
        console.error("❌ Fatal: Private key must be provided as 3rd argument.");
        process.exit(1);
    }
    const listener = new OracleListener(oracleId, port, privKey);
    listener.start();
}
