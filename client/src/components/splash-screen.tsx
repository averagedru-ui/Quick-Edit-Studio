import { useState, useEffect, useCallback } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [displayText, setDisplayText] = useState('');
  const [showStudio, setShowStudio] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  const fullText = 'CLUTCH';

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < fullText.length) {
        setDisplayText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typeInterval);
        setCursorVisible(false);
        setTimeout(() => setShowStudio(true), 300);
        setTimeout(() => setShowProgress(true), 900);
      }
    }, 130);

    return () => clearInterval(typeInterval);
  }, []);

  useEffect(() => {
    if (!showProgress) return;
    const start = performance.now();
    const duration = 2000;

    const animate = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * 100);

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => setFadeOut(true), 300);
        setTimeout(() => handleComplete(), 800);
      }
    };

    requestAnimationFrame(animate);
  }, [showProgress, handleComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: '#0c0c10' }}
      data-testid="splash-screen"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(190,242,100,0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute top-1/3 right-1/3 rounded-full"
          style={{
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, rgba(190,242,100,0.03) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="relative text-center select-none">
        <div className="flex items-center justify-center mb-3">
          <h1
            className="font-black tracking-tighter text-white"
            style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontFamily: "'Inter', sans-serif" }}
          >
            {displayText}
          </h1>
          {cursorVisible && (
            <span
              className="font-thin animate-pulse"
              style={{
                fontSize: 'clamp(3rem, 10vw, 6rem)',
                color: '#bef264',
              }}
            >
              |
            </span>
          )}
        </div>

        <p
          className={`tracking-[0.35em] uppercase transition-all duration-500 ${showStudio ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Studio
        </p>

        <div className={`mt-12 mx-auto transition-all duration-500 ${showProgress ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ width: 'min(320px, 80vw)' }}
        >
          <div className="h-[2px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: '#bef264',
                boxShadow: '0 0 10px rgba(190,242,100,0.3)',
                transition: 'none',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p
              className="tracking-wider"
              style={{
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.25)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              INITIALIZING ENGINE
            </p>
            <p
              style={{
                fontSize: '0.6rem',
                color: '#bef264',
                fontFamily: "'JetBrains Mono', monospace",
                opacity: 0.7,
              }}
            >
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
