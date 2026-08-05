import { useEffect, useRef, useState, useCallback } from "react";

interface AudioPreviewProps {
  src: string;
  filename?: string;
}

export function AudioPreview({ src, filename }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const formatExt = (name?: string) => {
    if (!name || !name.includes(".")) return "AUDIO";
    return name.split(".").pop()?.toUpperCase() || "AUDIO";
  };

  const fmtTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Generate initial waveform pattern immediately
  useEffect(() => {
    const defaultPeaks = Array.from({ length: 48 }, (_, i) => {
      const v = Math.abs(Math.sin(i * 0.24) * 0.65 + Math.cos(i * 0.14) * 0.35);
      return Math.max(0.18, Math.min(0.95, v));
    });
    setPeaks(defaultPeaks);

    let isMounted = true;
    const loadPeaks = async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0);
        const samples = 48;
        const blockSize = Math.floor(rawData.length / samples);
        const extractedPeaks: number[] = [];

        for (let i = 0; i < samples; i++) {
          const blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j += 8) {
            sum += Math.abs(rawData[blockStart + j] || 0);
          }
          extractedPeaks.push(sum / (blockSize / 8));
        }

        const maxPeak = Math.max(...extractedPeaks, 0.001);
        const normalized = extractedPeaks.map((p) => Math.max(0.15, p / maxPeak));

        if (isMounted) setPeaks(normalized);
        audioCtx.close();
      } catch {
        // Keep fallback peaks cleanly if decode fails
      }
    };

    loadPeaks();
    return () => {
      isMounted = false;
    };
  }, [src]);

  // Canvas drawing
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const displayPeaks = peaks.length > 0 ? peaks : Array.from({ length: 48 }, () => 0.3);
    const barCount = displayPeaks.length;
    const gap = 3;
    const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
    const progress = duration > 0 ? currentTime / duration : 0;
    const activeIndex = Math.floor(progress * barCount);

    for (let i = 0; i < barCount; i++) {
      const p = displayPeaks[i];
      const barHeight = Math.max(4, p * (height - 8));
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);

      if (i <= activeIndex) {
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, "#e07a5f");
        gradient.addColorStop(1, "#c05a3f");
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      }
      ctx.fill();
    }

    // Hover line indicator
    if (hoverX !== null && hoverX >= 0 && hoverX <= width) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(224, 122, 95, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [peaks, currentTime, duration, hoverX]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawWaveform());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawWaveform]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn("Audio play prevented:", err);
          setIsPlaying(false);
        });
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const newMute = !isMuted;
    audio.muted = newMute;
    setIsMuted(newMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    setHoverX(x);
    setHoverTime(ratio * duration);
  };

  const handleCanvasMouseLeave = () => {
    setHoverX(null);
    setHoverTime(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className="audio-card" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration || 0)}
      />

      {/* Header Info */}
      <div className="audio-card-head">
        <div className="audio-icon-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="audio-meta">
          <div className="audio-title">{filename || "Audio File"}</div>
          <div className="audio-badge">{formatExt(filename)}</div>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="audio-waveform-wrapper">
        <canvas
          ref={canvasRef}
          className="audio-waveform-canvas"
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onClick={handleCanvasClick}
        />
        {hoverTime !== null && hoverX !== null && (
          <div className="audio-scrub-tooltip" style={{ left: `${hoverX}px` }}>
            {fmtTime(hoverTime)}
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="audio-card-controls">
        <button
          className={`audio-play-btn ${isPlaying ? "playing" : ""}`}
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Play"}
          type="button"
        >
          {isPlaying ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="audio-timer">
          <span className="cur-time">{fmtTime(currentTime)}</span>
          <span className="sep">/</span>
          <span className="dur-time">{fmtTime(duration)}</span>
        </div>

        <div className="audio-volume-wrapper" onMouseLeave={() => setShowVolumeSlider(false)}>
          <button
            className="audio-vol-btn"
            onClick={toggleMute}
            onMouseEnter={() => setShowVolumeSlider(true)}
            title={isMuted ? "Unmute" : "Volume"}
            type="button"
          >
            {isMuted || volume === 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {showVolumeSlider && (
            <div className="audio-volume-popover" onClick={(e) => e.stopPropagation()}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="audio-vol-slider"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
