'use client';

import { useEffect, useRef } from 'react';
import styles from './CyberGrid.module.css';

export default function CyberGrid() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let cols: number, rows: number;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            cols = Math.floor(canvas.width / 40);
            rows = Math.floor(canvas.height / 40);
        };

        window.addEventListener('resize', resize);
        resize();

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(0, 224, 84, 0.04)';
            ctx.lineWidth = 1;

            for (let c = 0; c <= cols; c++) {
                ctx.beginPath();
                ctx.moveTo(c * 40, 0);
                ctx.lineTo(c * 40, canvas.height);
                ctx.stroke();
            }
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * 40);
                ctx.lineTo(canvas.width, r * 40);
                ctx.stroke();
            }
            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.canvas} />;
}
