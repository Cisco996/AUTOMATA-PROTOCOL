const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['net-snmp'],
    // Configuriamo Turbopack per Next.js 15/16
    turbopack: {
        // Impostiamo la root al livello del progetto principale per evitare conflitti di lockfile
        root: path.resolve(__dirname, '..'),
    },
};

module.exports = nextConfig;
