'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';

// ASCII character set for the scramble effect
const ASCII_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789(){}[]<>;:,._-+=!@#$%^&*|\\/\"'`~?";

const generateCode = (width: number, height: number): string => {
  let text = "";
  for (let i = 0; i < width * height; i++) {
    text += ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)];
  }
  let out = "";
  for (let i = 0; i < height; i++) {
    out += text.substring(i * width, (i + 1) * width) + "\n";
  }
  return out;
};

type ScannerCardStreamProps = {
  cardImages?: string[];
  repeat?: number;
  cardGap?: number;
  initialSpeed?: number;
  direction?: -1 | 1;
  friction?: number;
  scanEffect?: 'clip' | 'scramble';
};

export const ScannerCardStream = ({
  cardImages = [],
  repeat = 4,
  cardGap = 48,
  initialSpeed = 80,
  direction = -1,
  friction = 0.97,
  scanEffect = 'scramble',
}: ScannerCardStreamProps) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const cards = useMemo(() => {
    if (cardImages.length === 0) return [];
    const totalCards = cardImages.length * repeat;
    return Array.from({ length: totalCards }, (_, i) => ({
      id: i,
      image: cardImages[i % cardImages.length],
      ascii: generateCode(Math.floor(360 / 6.5), Math.floor(240 / 13)),
    }));
  }, [cardImages, repeat]);

  const cardLineRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalAscii = useRef(new Map<number, string>());
  const animFrameRef = useRef<number>(0);

  const streamState = useRef({
    position: 0,
    velocity: initialSpeed,
    direction,
    isDragging: false,
    lastMouseX: 0,
    lastTime: performance.now(),
    cardLineWidth: (360 + cardGap) * (cardImages.length * repeat),
    friction,
    minVelocity: 20,
  });

  const scannerStateRef = useRef({ isScanning: false });

  const runScramble = useCallback((el: HTMLElement, cardId: number) => {
    if (el.dataset.scrambling === 'true') return;
    el.dataset.scrambling = 'true';
    const original = originalAscii.current.get(cardId) || '';
    let count = 0;
    const iv = setInterval(() => {
      el.textContent = generateCode(Math.floor(360 / 6.5), Math.floor(240 / 13));
      if (++count >= 8) {
        clearInterval(iv);
        el.textContent = original;
        delete el.dataset.scrambling;
      }
    }, 35);
  }, []);

  useEffect(() => {
    const cardLine = cardLineRef.current;
    const pCanvas = particleCanvasRef.current;
    const sCanvas = scannerCanvasRef.current;
    if (!cardLine || !pCanvas || !sCanvas || cards.length === 0) return;

    cards.forEach(c => originalAscii.current.set(c.id, c.ascii));

    // Three.js particle setup
    const scene = new THREE.Scene();
    const W = window.innerWidth;
    const H = 280;
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 1000);
    camera.position.z = 100;
    const renderer = new THREE.WebGLRenderer({ canvas: pCanvas, alpha: true, antialias: false });
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    const N = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N);
    const alp = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * W * 2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * H;
      vel[i] = Math.random() * 50 + 20;
      alp[i] = Math.random() * 0.35 + 0.05;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alp, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 12.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vAlpha; void main() { vec2 uv = gl_PointCoord - 0.5; float d = length(uv); if(d > 0.5) discard; gl_FragColor = vec4(0.0, 1.0, 0.0, vAlpha * (1.0 - d * 2.0)); }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);

    // Scanner canvas
    const ctx = sCanvas.getContext('2d')!;
    sCanvas.width = W;
    sCanvas.height = H;

    // Drag
    const state = streamState.current;
    const onDown = (e: MouseEvent | TouchEvent) => {
      state.isDragging = true;
      if ('touches' in e) {
        state.lastMouseX = e.touches[0] ? e.touches[0].clientX : 0;
      } else {
        state.lastMouseX = (e as MouseEvent).clientX;
      }
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!state.isDragging) return;
      let x = 0;
      if ('touches' in e) {
        x = e.touches[0] ? e.touches[0].clientX : state.lastMouseX;
      } else {
        x = (e as MouseEvent).clientX;
      }
      const dx = x - state.lastMouseX;
      state.velocity = Math.abs(dx) * 8;
      state.direction = dx < 0 ? -1 : 1;
      state.position += dx;
      state.lastMouseX = x;
    };
    const onUp = () => { state.isDragging = false; };

    cardLine.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    cardLine.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    // Update card clip / scramble effects
    const updateCards = () => {
      const scanX = W / 2;
      const sw = 6;
      const sl = scanX - sw / 2;
      const sr = scanX + sw / 2;
      let anyScanning = false;

      cardLine.querySelectorAll<HTMLElement>('.fcard').forEach((wrapper, idx) => {
        const rect = wrapper.getBoundingClientRect();
        const norm = wrapper.querySelector<HTMLElement>('.fnorm')!;
        const asc = wrapper.querySelector<HTMLElement>('.fasc')!;
        const pre = asc.querySelector<HTMLElement>('pre')!;
        if (rect.left < sr && rect.right > sl) {
          anyScanning = true;
          if (scanEffect === 'scramble' && wrapper.dataset.scanned !== 'true') {
            runScramble(pre, idx);
          }
          wrapper.dataset.scanned = 'true';
          const il = Math.max(sl - rect.left, 0);
          const ir = Math.min(sr - rect.left, rect.width);
          norm.style.setProperty('--cr', `${(il / rect.width) * 100}%`);
          asc.style.setProperty('--cl', `${(ir / rect.width) * 100}%`);
        } else {
          delete wrapper.dataset.scanned;
          if (rect.right < sl) {
            norm.style.setProperty('--cr', '100%');
            asc.style.setProperty('--cl', '100%');
          } else {
            norm.style.setProperty('--cr', '0%');
            asc.style.setProperty('--cl', '0%');
          }
        }
      });
      setIsScanning(anyScanning);
      scannerStateRef.current.isScanning = anyScanning;
    };

    // Animation loop
    const animate = (now: number) => {
      const dt = (now - state.lastTime) / 1000;
      state.lastTime = now;

      if (!isPaused && !state.isDragging) {
        if (state.velocity > state.minVelocity) state.velocity *= state.friction;
        state.position += state.velocity * state.direction * dt;
      }

      const cw = state.cardLineWidth;
      const containerW = cardLine.parentElement?.offsetWidth ?? W;
      if (state.position < -cw) state.position = containerW;
      else if (state.position > containerW) state.position = -cw;

      cardLine.style.transform = `translateX(${state.position}px)`;
      updateCards();

      // Particles
      const time = now * 0.001;
      const positionAttr = geo.getAttribute('position');
      if (positionAttr) {
        const posArray = positionAttr.array as Float32Array;
        for (let i = 0; i < N; i++) {
          const i3 = i * 3;
          const p = posArray[i3] ?? 0;
          const v = vel[i] ?? 0;
          posArray[i3] = p + (v * 0.016);
          if ((posArray[i3] ?? 0) > W / 2 + 60) posArray[i3] = -W / 2 - 60;
          posArray[i3 + 1] = (posArray[i3 + 1] ?? 0) + Math.sin(time + i * 0.12) * 0.4;
        }
        positionAttr.needsUpdate = true;
      }
      renderer.render(scene, camera);

      // Scanner line particles
      ctx.clearRect(0, 0, W, H);
      if (scannerStateRef.current.isScanning) {
        for (let i = 0; i < 40; i++) {
          const x = W / 2 + (Math.random() - 0.5) * 4;
          const y = Math.random() * H;
          const r = Math.random() * 0.5 + 0.3;
          ctx.globalAlpha = Math.random() * 0.6 + 0.3;
          ctx.fillStyle = '#00FF00';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cardLine.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cardLine.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, [cards, cardGap, friction, scanEffect, runScramble, isPaused]);

  if (cards.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 280 }}>
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 w-full h-full z-0 pointer-events-none"
      />
      <canvas
        ref={scannerCanvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* Scanner line */}
      <div
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-[2px] z-20 pointer-events-none transition-opacity duration-300 ${
          isScanning ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'linear-gradient(to bottom, transparent, #00FF00, transparent)',
          boxShadow: '0 0 12px #00FF00, 0 0 24px rgba(0,255,0,0.4)',
        }}
      />

      {/* Card stream */}
      <div className="absolute inset-0 flex items-center overflow-hidden">
        <div
          ref={cardLineRef}
          className="flex items-center whitespace-nowrap cursor-grab active:cursor-grabbing select-none will-change-transform"
          style={{ gap: `${cardGap}px` }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              className="fcard relative shrink-0"
              style={{ width: 360, height: 240 }}
            >
              <div
                className="fnorm absolute inset-0 overflow-hidden"
                style={{ clipPath: 'inset(0 0 0 var(--cr, 0%))' }}
              >
                <img
                  src={card.image}
                  alt="card"
                  className="w-full h-full object-cover"
                  style={{ borderRadius: 0 }}
                />
              </div>
              <div
                className="fasc absolute inset-0 bg-black overflow-hidden"
                style={{ clipPath: 'inset(0 calc(100% - var(--cl, 0%)) 0 0)' }}
              >
                <pre className="absolute inset-0 text-[rgba(0,255,0,0.5)] font-mono text-[10px] leading-[13px] overflow-hidden whitespace-pre m-0 p-0">
                  {card.ascii}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
