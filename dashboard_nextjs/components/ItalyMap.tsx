'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './ItalyMap.module.css';

interface Props {
    statusMap: Record<string, number>;
}

const OLT_CITIES = [
    'Milano', 'Torino', 'Venezia', 'Bologna', 'Genova',
    'Firenze', 'Ancona', 'Perugia', 'Pescara', 'Roma',
    'Bari', 'Napoli', 'Potenza', 'Sassari', 'Cagliari',
    'Catanzaro', 'Palermo', 'Catania', 'Messina', 'Ragusa',
];

const ITALY_COORDS: [number, number][] = [
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

// Cyber Colors
const STATUS_COLOR: Record<number, string> = {
    1: '#00e054', // Operational (Vibrant Green)
    2: '#ff3131', // Alarm (Cyber Red)
    0: '#666666', // Offline (Gray)
};

const STATUS_LABEL: Record<number, string> = {
    1: 'Operational',
    2: 'Alarm',
    0: 'Offline',
};

const STATUS_EMOJI: Record<number, string> = {
    1: '🟢',
    2: '🔴',
    0: '⚫',
};

export default function ItalyMap({ statusMap }: Props) {
    // Custom icon generator
    const createMarkerIcon = (status: number) => {
        const color = STATUS_COLOR[status];
        // Pulsing ring for Alarm AND Offline
        const pulse = (status === 2 || status === 0) ? `<div class="${styles.pulseRing}" style="color: ${color};"></div>` : '';

        return L.divIcon({
            className: styles.customMarker,
            html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                    ${pulse}
                    <div class="${styles.markerDot}" style="background-color: ${color}; box-shadow: 0 0 12px ${color};"></div>
                </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
    };

    return (
        <div className={styles.mapContainer}>
            <MapContainer
                center={[41.2, 12.5]}
                zoom={6}
                style={{ height: '620px', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
                className={styles.leafletMap}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                    subdomains="abcd"
                />

                {ITALY_COORDS.map(([lat, lon], idx) => {
                    const id = String(idx + 1);
                    const status = statusMap[id] ?? 0;
                    const city = OLT_CITIES[idx];

                    return (
                        <Marker
                            key={id}
                            position={[lat, lon]}
                            icon={createMarkerIcon(status)}
                        >
                            <Tooltip
                                permanent={false}
                                direction="top"
                                offset={[0, -10]}
                                className={styles.leafletTooltip}
                            >
                                <div className={styles.tooltipContent}>
                                    <div className={styles.tooltipHeader}>
                                        <strong>OLT {id}</strong>
                                        <span className={styles.tooltipCity}>{city.toUpperCase()}</span>
                                    </div>
                                    <div className={styles.tooltipStatus}>
                                        <span>{STATUS_EMOJI[status]}</span>
                                        <span style={{ color: STATUS_COLOR[status] }}>
                                            {STATUS_LABEL[status].toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}
            </MapContainer>

            {/* Legend */}
            <div className={styles.legend}>
                {([1, 2, 0] as const).map(s => (
                    <div key={s} className={styles.legendItem}>
                        <span
                            className={styles.dot}
                            style={{
                                background: STATUS_COLOR[s],
                                boxShadow: s !== 0 ? `0 0 10px ${STATUS_COLOR[s]}` : 'none'
                            }}
                        />
                        <span>{STATUS_LABEL[s]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

