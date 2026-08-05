import { useEffect, useRef, useState } from "react";

interface AudioPreviewProps {
  src: string;
}

export function AudioPreview({ src }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Format seconds to mm:ss
  const fmtTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  // Draw waveform bars on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = 4;
    const gap = 3;
    const totalWidth = barCount * (barWidth + gap);
    const startX = (width - totalWidth) / 2;

    const progress = duration > 0 ? currentTime / duration : 0;
    const activeIndex = Math.floor(progress * barCount);

    for (let i = 0; i < barCount; i++) {
      // Pseudo-random deterministic heights for aesthetic waveform pattern
      const pseudoRandom = Math.abs(Math.sin(i * 12.9898 + (i % 5) * 78.233)) * 0.75 + 0.25;
      const barHeight = Math.max(6, pseudoRandom * (height - 12));
      const x = startX + i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);

      if (i <= activeIndex) {
        ctx.fillStyle = "#e07a5f"; // terracotta active theme color
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      }
      ctx.fill();
    }
  }, [currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    <div className="audio-preview-container">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={300}
        height={56}
        className="waveform-canvas"
        onClick={handleCanvasClick}
        title="Click to seek"
      />

      {/* Controls Bar */}
      <div className="audio-controls">
        <button className="audio-btn play-btn" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="audio-time">
          <span>{fmtTime(currentTime)}</span> / <span>{fmtTime(duration)}</span>
        </div>

        <button className="audio-btn mute-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
