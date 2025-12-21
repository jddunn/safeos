'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { detectMotion } from '@/lib/motion-detection';
import { getAudioLevel } from '@/lib/audio-levels';

interface CameraFeedProps {
  onFrame?: (frameData: string, motionScore: number, audioLevel: number) => void;
  motionThreshold?: number;
  captureInterval?: number;
}

export default function CameraFeed({
  onFrame,
  motionThreshold = 0.15,
  captureInterval = 1000,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera and audio
  useEffect(() => {
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'environment' },
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Set up audio analysis
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        setHasPermission(true);
        setError(null);
      } catch (err) {
        console.error('Failed to access camera/mic:', err);
        setHasPermission(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to access camera and microphone'
        );
      }
    }

    initMedia();

    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Capture frames at interval
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== 4) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Get image data for motion detection
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Calculate motion score
    let motionScore = 0;
    if (prevFrameRef.current) {
      const result = detectMotion(prevFrameRef.current, currentFrame, motionThreshold);
      motionScore = result.score;
    }

    // Store current frame for next comparison
    prevFrameRef.current = currentFrame;

    // Get audio level
    let audioLevel = 0;
    if (analyserRef.current) {
      audioLevel = getAudioLevel(analyserRef.current);
    }

    // Only send frame if motion detected or significant audio
    if (motionScore > motionThreshold || audioLevel > 0.3) {
      // Convert to base64
      const frameData = canvas.toDataURL('image/jpeg', 0.7);

      if (onFrame) {
        onFrame(frameData, motionScore, audioLevel);
      }
    }
  }, [motionThreshold, onFrame]);

  // Set up capture interval
  useEffect(() => {
    if (!hasPermission) return;

    const interval = setInterval(captureFrame, captureInterval);
    return () => clearInterval(interval);
  }, [hasPermission, captureFrame, captureInterval]);

  // Permission denied state
  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-500/10 text-red-400 p-8">
        <svg
          className="w-12 h-12 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="font-semibold mb-2">Camera Access Required</h3>
        <p className="text-sm text-center text-white/60">{error}</p>
        <p className="text-xs text-center text-white/40 mt-4">
          Please allow camera and microphone access in your browser settings.
        </p>
      </div>
    );
  }

  // Loading state
  if (hasPermission === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-white/20 border-t-safeos-400 rounded-full animate-spin mb-4" />
        <p className="text-sm text-white/60">Requesting camera access...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

