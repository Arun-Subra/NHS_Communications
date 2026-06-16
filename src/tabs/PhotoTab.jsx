import { useEffect, useRef, useState, useCallback } from 'react';
import { C } from '../styles/shared.js';

const s = {
  container: {
    position: 'relative',
    flex: 1,
    height: '100%',
    minHeight: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '18px 16px',
    background: 'linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))',
    color: C.white,
    zIndex: 2,
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    opacity: 0.9,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    zIndex: 3,
  },
  shutterOuter: {
    width: '92px',
    height: '92px',
    borderRadius: '50%',
    border: `4px solid ${C.white}`,
    boxShadow: `0 0 0 4px ${C.primary}, 0 4px 18px rgba(0,102,204,0.4)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.15)',
    padding: 0,
    transition: 'transform 0.1s ease',
  },
  shutterInner: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: C.primary,
  },
  shutterInnerActive: {
    width: '62px',
    height: '62px',
    borderRadius: '50%',
    backgroundColor: C.primaryDark,
  },
  feedback: {
    margin: 0,
    padding: '7px 12px',
    borderRadius: '999px',
    backgroundColor: C.overlay,
    color: C.white,
    fontSize: '14px',
    fontWeight: '600',
    minHeight: '20px',
  },
  errorCard: {
    backgroundColor: C.white,
    color: C.textMid,
    padding: '18px',
    margin: '16px',
    borderRadius: '10px',
    textAlign: 'center',
    zIndex: 4,
  },
  errorTitle: {
    margin: '0 0 8px',
    color: C.red,
    fontSize: '17px',
    fontWeight: '700',
  },
  preview: {
    position: 'absolute',
    right: '16px',
    bottom: '36px',
    width: '64px',
    height: '88px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: `2px solid ${C.white}`,
    zIndex: 4,
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
  },
};

const SCAN_MESSAGES = [
  'Capturing image…',
  'Analyzing document…',
  'Extracting details…',
  'Almost done…',
];

export default function PhotoTab({ patient, apiFetch, onNavigate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const uploadAbortRef = useRef(null);
  const isMountedRef = useRef(true);

  const [status, setStatus] = useState('starting-camera'); // starting-camera | idle | sending | sent | error | camera-error
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [scanMsgIdx, setScanMsgIdx] = useState(0);

  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');

  const safeSetStatus = (value) => {
    if (isMountedRef.current) setStatus(value);
  };

  const stopCurrentStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchAvailable(false);
    setIsTorchOn(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        safeSetStatus('starting-camera');
        setCameraError('');

        // Ensure previous stream is closed before opening a new one
        stopCurrentStream();

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });

        if (cancelled || !isMountedRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Torch support check
        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            const capabilities = track.getCapabilities?.();
            if (capabilities?.torch) {
              setTorchAvailable(true);
            }
          } catch {
            // Some browsers throw here; ignore safely
            setTorchAvailable(false);
          }
        }

        safeSetStatus('idle');
      } catch (err) {
        console.error('Camera start failed:', err);
        setCameraError(
          'Camera access failed. Check browser permissions and make sure you are using localhost or HTTPS.'
        );
        safeSetStatus('camera-error');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCurrentStream();
    };
  }, [facingMode, stopCurrentStream]);

  const toggleCamera = useCallback(() => {
    if (status === 'starting-camera' || status === 'sending') return;
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  }, [status]);

  const captureCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      throw new Error('Camera components are not ready.');
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Camera is not ready yet.');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire canvas context.');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: !isTorchOn }],
      });
      setIsTorchOn(prev => !prev);
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  }, [isTorchOn]);

  const handleShutter = useCallback(async () => {
    if (!patient?.nhs_number || status === 'sending' || status === 'starting-camera') return;

    safeSetStatus('sending');

    try {
      const imageDataUrl = captureCurrentFrame();
      setCapturedImage(imageDataUrl);

      // Abort any previous upload attempt
      if (uploadAbortRef.current) uploadAbortRef.current.abort();
      uploadAbortRef.current = new AbortController();

      await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nhs_number: patient.nhs_number,
          image_data: imageDataUrl,
          scan_type: 'auto_detect',
        }),
        signal: uploadAbortRef.current.signal,
      });

      // Fire-and-forget processing
      apiFetch('/api/process-summaries', { method: 'POST' }).catch(console.error);

      safeSetStatus('sent');

      setTimeout(() => {
        if (!isMountedRef.current) return;
        safeSetStatus('idle');
        onNavigate?.('messages');
      }, 1600);
    } catch (err) {
      if (err?.name === 'AbortError') {
        console.warn('Upload aborted');
        return;
      }

      console.error('Upload failed:', err);
      safeSetStatus('error');

      setTimeout(() => {
        if (!isMountedRef.current) return;
        safeSetStatus('idle');
      }, 2200);
    }
  }, [apiFetch, captureCurrentFrame, onNavigate, patient?.nhs_number, status]);

  useEffect(() => {
    if (status !== 'sending') return;
    setScanMsgIdx(0);

    const id = setInterval(() => {
      setScanMsgIdx(i => (i + 1) % SCAN_MESSAGES.length);
    }, 1800);

    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    return () => {
      if (uploadAbortRef.current) uploadAbortRef.current.abort();
      stopCurrentStream();
    };
  }, [stopCurrentStream]);

  const feedbackText =
    status === 'starting-camera'
      ? 'Starting camera…'
      : status === 'sending'
      ? SCAN_MESSAGES[scanMsgIdx]
      : status === 'sent'
      ? 'Scan sent!'
      : status === 'error'
      ? 'Failed — try again'
      : 'Point camera at your NHS document';

  if (patient === null) {
    return (
      <div style={s.container}>
        <div style={s.errorCard}>
          <p style={s.errorTitle}>Loading...</p>
          <p>Connecting to secure record...</p>
        </div>
      </div>
    );
  }

  if (!patient || !patient.nhs_number) {
    return (
      <div style={s.container}>
        <div style={s.errorCard}>
          <p style={s.errorTitle}>No patient linked</p>
          <p>No NHS record linked to this account.</p>
        </div>
      </div>
    );
  }

  if (status === 'camera-error') {
    return (
      <div style={s.container}>
        <div style={s.errorCard}>
          <p style={s.errorTitle}>Camera unavailable</p>
          <p>{cameraError}</p>
        </div>
      </div>
    );
  }

  const controlsDisabled = status === 'starting-camera' || status === 'sending';

  return (
    <div style={s.container}>
      <video ref={videoRef} style={s.video} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={s.topOverlay}>
        <p style={s.title}>Scan a document</p>
        <p style={s.subtitle}>Take a photo of any NHS letter or prescription</p>
      </div>

      {capturedImage && (
        <img src={capturedImage} alt="Last captured scan" style={s.preview} />
      )}

      <div style={s.controls}>
        <button
          onClick={toggleCamera}
          disabled={controlsDisabled}
          style={{
            position: 'absolute',
            left: '32px',
            bottom: '24px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: `2px solid ${C.white}`,
            color: C.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: controlsDisabled ? 'not-allowed' : 'pointer',
            zIndex: 10,
            transition: 'opacity 0.2s',
            opacity: controlsDisabled ? 0.5 : 1,
          }}
          aria-label="Switch camera"
        >
          <span style={{ fontSize: '20px' }}>🔄</span>
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            disabled={controlsDisabled}
            style={{
              position: 'absolute',
              right: '32px',
              bottom: '24px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: isTorchOn ? C.primary : 'rgba(255,255,255,0.2)',
              border: `2px solid ${C.white}`,
              color: C.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: controlsDisabled ? 'not-allowed' : 'pointer',
              zIndex: 10,
              opacity: controlsDisabled ? 0.5 : 1,
            }}
            aria-label="Toggle flashlight"
          >
            <span style={{ fontSize: '20px' }}>{isTorchOn ? '💡' : '🔦'}</span>
          </button>
        )}

        <button
          style={{
            ...s.shutterOuter,
            transform: status === 'sending' ? 'scale(0.92)' : 'scale(1)',
            opacity: controlsDisabled ? 0.8 : 1,
            cursor: controlsDisabled ? 'not-allowed' : 'pointer',
          }}
          onClick={handleShutter}
          disabled={controlsDisabled}
          aria-label="Take photo and send scan"
        >
          <div style={status === 'sending' ? s.shutterInnerActive : s.shutterInner} />
        </button>

        <p style={{ ...s.feedback, color: status === 'error' ? '#FFB4A8' : C.white }}>
          {feedbackText}
        </p>
      </div>
    </div>
  );
}