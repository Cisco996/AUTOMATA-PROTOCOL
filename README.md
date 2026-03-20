# 📡 Automata Protocol — SDK Edition

[![IOTA Rebased](https://img.shields.io/badge/Blockchain-IOTA%20Rebased-blue?style=for-the-badge&logo=iota)](https://iota.org)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-007ACC?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

A high-performance, decentralized monitoring and notarization system for **Optical Line Terminals (OLT)**, built on the **IOTA Rebased** architecture using the **official TypeScript SDK**.

---

## 🚀 Project Overview

This project implements a **granular parallelized Oracle network** designed to monitor 20 OLT devices via **SNMP V3 (AuthPriv)** and notarize their status changes (Operational, Alarm, Offline) directly onto the IOTA blockchain. 

By leveraging **Move Smart Contracts** and the **IOTA TS SDK**, the system achieves millisecond-latency signing and zero-conflict updates, ensuring each OLT is an independent asset on-chain.

### Key Features
*   ⚡ **Real-time Notarization**: Millisecond transaction signing in-memory (Native SDK) with <50ms latency.
*   🛡️ **Blockchain Reliability**: Leverages native IOTA metadata (`timestampMs`) to ensure every event is counted correctly, eliminating counter freezes (no more "stuck at 50" issues).
*   🌐 **Distributed Oracle Grid**: 10 independent Oracle nodes with automated quorum validation.
*   📡 **SNMP V3 Integration**: Secure trap handling with SHA authentication and AES encryption.
*   📊 **Cyber-Aesthetic Dashboard**: New color-coded KPIs for quick diagnostics: 🟢 Votes, 🔵 Blockchain Confirmations, 🟢 Confirmation Rate.
*   📂 **Centralized Key Management**: Secure configuration via the `ORACLE_KEYS` variable in your `.env.local` file (no external JSON files required).

---

## 📂 Repository Structure

```text
/
├── notarization_v2/       # Move Smart Contract source (IOTA Rebased)
└── dashboard_nextjs/      # Real-time Next.js Dashboard & Backend
    ├── .env.local         # KEY CONFIGURATION (ORACLE_KEYS, PACKAGE_ID, etc.)
    ├── app/               # API Routes (Oracle Ping, Simulation Controller)
    ├── components/        # UI Components (Italy Map, Olt Grid, Audit Log)
    ├── lib/iota.ts        # IOTA SDK Bridge & Data Layer (Enhanced Timestamp Logic)
    ├── lib/sim_manager.ts # System Orchestrator: manages local Oracle processes
    └── oracle_listener.ts # Main Oracle Worker: SNMP V3 & SDK Signing
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites
*   **Node.js** (v18.x or higher)
*   **IOTA CLI (Rebased)**: Required for contract management and wallet generation. [Installation Guide](https://docs.iota.org)
*   **IOTA Testnet Wallet**: An account with Testnet tokens as the **active address** (for gas fees and funding).

### 2. Automated Setup (Recommended)
The project includes a Node.js script to automate the entire environment setup:
```bash
node setup_iota_system.js
```
The script will:
*   **Check CLI**: Verify `iota` CLI is installed.
*   **Generate Wallets**: Create 10 independent Oracle wallets (if missing).
*   **Faucet**: Request funds from Testnet if active wallet has <10 IOTA.
*   **Fund Oracles**: Send 0.9 IOTA to each Oracle from your active wallet.
*   **Deploy Contract**: Optionally publish the `notarization_v2` Move package.
*   **On-Chain Registry**: Create 20 OLT objects and authorize Oracles automatically.
*   **Config Generation**: Write all IDs and keys into `dashboard_nextjs/.env.local`.

---

### 3. Manual Steps (Admin CLI)
If needed, you can manage the system manually using these commands:
*   **Set Quorum**: `iota client call --package $PKG --module notarizer_v2 --function set_threshold --args $ADMIN_CAP $REGISTRY 3`
*   **Grant Perms**: `iota client call --package $PKG --module notarizer_v2 --function grant_group_permission --args $ADMIN_CAP $REGISTRY $ADDR $GROUP`
*   **Create OLT**: `iota client call --package $PKG --module notarizer_v2 --function create_olt_state --args $ADMIN_CAP $REGISTRY $OLT_ID $GROUP`

---

## 🚀 Launching the System

1.  **Install Frontend Dependencies**:
    ```bash
    cd dashboard_nextjs
    npm install
    ```
2.  **Start Dashboard**:
    ```bash
    npm run dev
    ```
3.  **Initialize Simulation**:
    - Open [http://localhost:3000](http://localhost:3000)
    - Navigate to **SIM Test Center**.
    - Click **🚀 LAUNCH ENTIRE SYSTEM**.

---

## 🛡️ Security & Disclaimer
This is an **MVP (Minimum Viable Product)** designed for Testnet environments. **Never** commit your private keys to Git. Always use dedicated Testnet accounts and local environment variables.

---
*Developed for the IOTA Ecosystem — 2026 (Automata Protocol)*
