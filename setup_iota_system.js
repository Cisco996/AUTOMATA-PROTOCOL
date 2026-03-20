const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * UTILITIES
 */
function run(command) {
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        return output.trim();
    } catch (error) {
        console.error(`Error running command: ${command}`);
        console.error(error.message);
        return null;
    }
}

function runJson(command) {
    const output = run(command);
    if (!output) return null;
    try {
        return JSON.parse(output);
    } catch (e) {
        console.error(`Failed to parse JSON for command: ${command}`);
        // Sometimes the output contains a lot of junk before/after JSON
        const match = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) {}
        }
        return null;
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * MAIN SETUP
 */
async function main() {
    console.log("📡 Automata Protocol - Automated Setup Script\n");

    // 1. Check IOTA CLI
    const version = run('iota --version');
    if (!version) {
        console.error("❌ IOTA CLI not found. Please install it first.");
        process.exit(1);
    }
    console.log(`✅ IOTA CLI detected: ${version}`);

    // 2. Identify Admin Transaction Address
    const adminAddr = runJson('iota client active-address --json');
    if (!adminAddr) {
        console.error("❌ Could not determine active IOTA address. Run 'iota client addresses' first.");
        process.exit(1);
    }
    console.log(`👤 Admin Address: ${adminAddr}`);

    // 3. Manage Oracle Wallets
    console.log("\n📦 Checking Oracle Wallets...");
    const keys = runJson('iota keytool list --json') || [];
    let oracleAddresses = keys
        .filter(k => k.iotaAddress !== adminAddr)
        .map(k => k.iotaAddress);

    while (oracleAddresses.length < 10) {
        console.log(`🏗️  Generating oracle wallet ${oracleAddresses.length + 1}/10...`);
        const newAddrObj = runJson('iota client new-address ed25519 --json');
        if (newAddrObj && newAddrObj.iotaAddress) {
            oracleAddresses.push(newAddrObj.iotaAddress);
        } else {
            // Fallback if --json fails or returns different format
            const output = run('iota client new-address ed25519');
            const match = output.match(/0x[a-fA-F0-9]{64}/);
            if (match) oracleAddresses.push(match[0]);
        }
    }
    
    // Take exactly 10
    const finalOracles = oracleAddresses.slice(0, 10);
    console.log(`✅ 10 Oracle wallets ready.`);

    // 4. Export Private Keys for .env.local
    console.log("\n🔑 Exporting Oracle Private Keys...");
    const oracleKeys = {};
    for (let i = 0; i < 10; i++) {
        const addr = finalOracles[i];
        const keyData = runJson(`iota keytool export ${addr} --json`);
        if (keyData && keyData.exportedPrivateKey) {
            oracleKeys[i + 1] = keyData.exportedPrivateKey;
        } else {
            console.warn(`⚠️  Could not export private key for ${addr}`);
        }
    }

    // 5. Check and Fund Wallets (Master -> Oracles)
    console.log("\n💰 Checking Master Wallet Balance...");
    const ADMIN_THRESHOLD = 1000000000n; // 1 IOTA
    const ORACLE_THRESHOLD = 900000000n; // 0.9 IOTA
    
    let adminBalData = runJson(`iota client balance --json`);
    
    // Improved recursive search for balance in nested CLI output
    function findBalance(obj) {
        if (!obj) return 0n;
        
        // If it's a direct number-like string (e.g. "12345")
        if (typeof obj === 'string' && /^\d+$/.test(obj)) {
            return BigInt(obj);
        }

        if (typeof obj === 'object') {
            // Priority keys
            if (obj.balance !== undefined && obj.balance !== null) return BigInt(String(obj.balance));
            if (obj.totalBalance !== undefined && obj.totalBalance !== null) return BigInt(String(obj.totalBalance));
            
            if (Array.isArray(obj)) {
                for (let item of obj) {
                    const b = findBalance(item);
                    if (b > 0n) return b;
                }
            } else {
                for (let k in obj) {
                    // Skip symbols/names to avoid errors like BigInt("IOTA")
                    if (k === 'symbol' || k === 'name') continue;
                    const b = findBalance(obj[k]);
                    if (b > 0n) return b;
                }
            }
        }
        return 0n;
    }

    let adminTotal = findBalance(adminBalData);
    console.log(`💳 Master Wallet Balance: ${Number(adminTotal) / 1000000000} IOTA`);

    // AUTO-FAUCET if below 1 IOTA
    if (adminTotal < ADMIN_THRESHOLD) {
        console.log(`🚰 Balance below 1 IOTA. Requesting funds from Testnet Faucet...`);
        run(`iota client faucet`);
        console.log(`⏳ Waiting 15 seconds for faucet confirmation...`);
        await new Promise(r => setTimeout(r, 15000));
        adminBalData = runJson(`iota client balance --json`);
        adminTotal = findBalance(adminBalData);
        console.log(`💳 New Master Wallet Balance: ${Number(adminTotal) / 1000000000} IOTA`);
    }

    console.log(`\n🤖 Funding Oracles (Target: 0.9 IOTA each)...`);
    for (const addr of finalOracles) {
        const balanceData = runJson(`iota client balance ${addr} --json`);
        const currentBalance = findBalance(balanceData);
        
        if (currentBalance < ORACLE_THRESHOLD) {
            const needed = ORACLE_THRESHOLD - currentBalance;
            
            if (adminTotal < (needed + 20000000n)) {
                console.error(`❌ INSUFFICIENT FUNDS even after faucet request.`);
                process.exit(1);
            }

            const iotaNeeded = Number(needed) / 1000000000;
            console.log(`💸 Funding ${addr} with ${iotaNeeded.toFixed(2)} IOTA...`);
            const fundRes = run(`iota client pay-iota --recipients ${addr} --amounts ${needed} --gas-budget 20000000`);
            
            if (!fundRes) {
                console.error(`❌ Funding failed for ${addr}. Stopping script.`);
                process.exit(1);
            }
        } else {
            console.log(`✅ ${addr} already has ${Number(currentBalance)/1e9} IOTA.`);
        }
    }

    // 6. Publish Contract (Optional)
    let packageId = "";
    let registryId = "";
    let adminCapId = "";
    let oltObjectIds = {};

    const doPublish = await ask("\n🚀 Do you want to publish the Move package (./notarization_v2)? (y/n): ");
    if (doPublish.toLowerCase() === 'y') {
        process.chdir('notarization_v2');
        console.log("🔨 Publishing contract...");
        
        // Fix for "Access Denied" on Move.lock in some environments
        if (fs.existsSync('Move.lock')) {
            try { fs.unlinkSync('Move.lock'); } catch(e) {}
        }

        const publishResult = runJson('iota client publish --gas-budget 100000000 --json --skip-dependency-verification');
        process.chdir('..');

        if (!publishResult || !publishResult.objectChanges) {
            console.error("❌ Publish failed or returned invalid data.");
            process.exit(1);
        }

        // Extract IDs from objectChanges
        for (const change of publishResult.objectChanges) {
            if (change.type === 'published') {
                packageId = change.packageId;
            } else if (change.type === 'created') {
                if (change.objectType.endsWith('::AdminCap')) adminCapId = change.objectId;
                if (change.objectType.endsWith('::OracleRegistry')) registryId = change.objectId;
            }
        }

        console.log(`✅ Deployed Package: ${packageId}`);
        console.log(`✅ Registry ID: ${registryId}`);
        console.log(`✅ AdminCap ID: ${adminCapId}`);

        // 7. Initialize OLTs
        console.log("\n📡 Creating 20 OLT objects on-chain...");
        for (let i = 1; i <= 20; i++) {
            const groupId = i <= 10 ? 1 : 2;
            console.log(`   - Creating OLT ${i} (Group ${groupId})...`);
            const cmd = `iota client call --package ${packageId} --module notarizer_v2 --function create_olt_state --args ${adminCapId} ${registryId} ${i} ${groupId} --gas-budget 20000000 --json`;
            const callResult = runJson(cmd);
            
            if (callResult && callResult.objectChanges) {
                const oltObj = callResult.objectChanges.find(c => c.type === 'created' && c.objectType.endsWith('::OltState'));
                if (oltObj) {
                    oltObjectIds[i] = oltObj.objectId;
                }
            }
        }
        
        // 8. Authorize Oracles
        console.log("\n🛡️  Authorizing Oracles on-chain...");
        for (let i = 0; i < 10; i++) {
            const addr = finalOracles[i];
            const groupId = (i < 5) ? 1 : 2; // Oracles 1-5 Group 1, 6-10 Group 2
            console.log(`   - Granting Oracle ${i+1} permission for Group ${groupId}...`);
            run(`iota client call --package ${packageId} --module notarizer_v2 --function grant_group_permission --args ${adminCapId} ${registryId} ${addr} ${groupId} --gas-budget 10000000`);
        }
    } else {
        console.log("\n⏭️  Skipping publish. Please ensure .env.local is updated manually or the script will only update Oracle keys.");
        // Try to read existing values from .env.local if it exists
        const envPath = path.join('dashboard_nextjs', '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            packageId = content.match(/PACKAGE_ID=(0x[a-f0-9]+)/)?.[1] || "";
            registryId = content.match(/REGISTRY_ID=(0x[a-f0-9]+)/)?.[1] || "";
            const oltMatch = content.match(/OLT_OBJECT_IDS=({.*})/);
            if (oltMatch) try { oltObjectIds = JSON.parse(oltMatch[1]); } catch(e) {}
        }
    }

    // 9. Update .env.local
    console.log("\n📝 Updating dashboard_nextjs/.env.local...");
    const envTemplate = `# Automata Protocol - Auto-generated Configuration
PACKAGE_ID=${packageId}
REGISTRY_ID=${registryId}
RPC_URL=https://api.testnet.iota.cafe
MODULE_NAME=notarizer_v2
TIMEOUT_LIMIT=70

# Oracle Addresses for Reference:
# ${finalOracles.map((a, i) => `Oracle ${i+1}: ${a}`).join('\n# ')}

ORACLE_KEYS=${JSON.stringify(oracleKeys)}
OLT_OBJECT_IDS=${JSON.stringify(oltObjectIds)}
`;

    const envPath = path.join('dashboard_nextjs', '.env.local');
    fs.writeFileSync(envPath, envTemplate);
    console.log(`✅ File updated: ${envPath}`);

    console.log("\n🎉 Setup complete! You can now run 'npm run dev' in dashboard_nextjs/");
    rl.close();
}

main();
