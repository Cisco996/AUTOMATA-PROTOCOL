'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Step {
    icon: string;
    title: string;
    description: string;
}

interface HowItWorksModalProps {
    title: string;
    subtitle: string;
    steps: Step[];
    footer?: string;
}

export default function HowItWorksModal({ title, subtitle, steps, footer }: HowItWorksModalProps) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        if (open) window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open]);

    const modal = open ? (
        <div
            onClick={() => setOpen(false)}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.8)',
                zIndex: 99999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
                backdropFilter: 'blur(4px)',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'relative', zIndex: 100000,
                    background: '#0d1826',
                    border: '1px solid rgba(0,224,84,0.3)',
                    borderRadius: '8px',
                    maxWidth: '620px', width: '100%',
                    maxHeight: '85vh', overflowY: 'auto',
                    boxShadow: '0 0 40px rgba(0,224,84,0.12), 0 20px 60px rgba(0,0,0,0.6)',
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,224,84,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: '#00e054', letterSpacing: '0.15em', marginBottom: '4px', opacity: 0.7 }}>
                            // HOW IT WORKS
                        </div>
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '1rem', color: '#e2e8f0', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                            {title}
                        </div>
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem', color: '#4a6080', marginTop: '4px', letterSpacing: '0.05em' }}>
                            {subtitle}
                        </div>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        style={{ background: 'transparent', border: 'none', color: '#4a6080', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px', lineHeight: 1, marginLeft: '16px', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#4a6080')}
                    >✕</button>
                </div>

                {/* Steps */}
                <div style={{ padding: '20px 24px' }}>
                    {steps.map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '16px', marginBottom: idx < steps.length - 1 ? '20px' : '0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(0,224,84,0.4)', background: 'rgba(0,224,84,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                                    {step.icon}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div style={{ width: '1px', flex: 1, minHeight: '16px', background: 'rgba(0,224,84,0.15)', marginTop: '6px' }} />
                                )}
                            </div>
                            <div style={{ paddingTop: '6px', paddingBottom: idx < steps.length - 1 ? '14px' : '0' }}>
                                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.78rem', color: '#00e054', letterSpacing: '0.06em', marginBottom: '4px', fontWeight: 'bold' }}>
                                    {step.title}
                                </div>
                                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem', color: '#8a9bb0', lineHeight: 1.6, letterSpacing: '0.02em' }}>
                                    {step.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(0,224,84,0.1)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.68rem', color: '#4a6080', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                        💡 {footer}
                    </div>
                )}
            </div>
        </div>
    ) : null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', background: 'transparent', border: '1px solid #00e054', borderRadius: '4px', color: '#00e054', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.08em', cursor: 'pointer', opacity: 0.85, transition: 'opacity 0.2s, background 0.2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,224,84,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
                ℹ️ HOW IT WORKS
            </button>

            {mounted && createPortal(modal, document.body)}
        </>
    );
}
