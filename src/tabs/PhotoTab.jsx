import { useEffect, useRef, useState } from 'react';
import { C } from '../styles/shared.js';

const s = {
  container: {
    position: 'relative',
    flex: 1,
    minHeight: 'calc(100svh - 80px)',
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

export default function PhotoTab({ patient, apiFetch }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState('starting-camera');
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('idle');
      } catch (err) {
        setCameraError(
          'Camera access failed. Check browser permissions and make sure you are using localhost or HTTPS.'
        );
        setStatus('camera-error');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureCurrentFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Camera is not ready yet.');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleShutter = async () => {
    if (!patient || status === 'sending') return;

    setStatus('sending');

    try {
      const imageDataUrl = captureCurrentFrame();
      setCapturedImage(imageDataUrl);

      await apiFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nhs_number: patient.nhs_number,
          image_data: imageDataUrl,
          scan_type: 'appointment_letter',
        }),
      });

      setStatus('sent');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const feedbackText =
    status === 'starting-camera' ? 'Starting camera…'
    : status === 'sending' ? 'Capturing scan…'
    : status === 'sent' ? 'Scan sent!'
    : status === 'error' ? 'Failed — try again'
    : 'Point camera at your NHS letter';

  if (!patient) {
    return (
      <div style={s.container}>
        <div style={s.errorCard}>
          <p style={s.errorTitle}>Not connected</p>
          <p>Could not connect to the NHS database.</p>
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

  return (
    <div style={s.container}>
      <video
        ref={videoRef}
        style={s.video}
        autoPlay
        playsInline
        muted
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={s.topOverlay}>
        <p style={s.title}>Scan a document</p>
        <p style={s.subtitle}>Take a photo of an NHS letter or prescription</p>
      </div>

      {capturedImage && (
        <img
          src={capturedImage}
          alt="Last captured scan"
          style={s.preview}
        />
      )}

      <div style={s.controls}>
        <button
          style={{
            ...s.shutterOuter,
            transform: status === 'sending' ? 'scale(0.92)' : 'scale(1)',
          }}
          onClick={handleShutter}
          disabled={status === 'sending' || status === 'starting-camera'}
          aria-label="Take photo and send scan"
        >
          <div style={status === 'sending' ? s.shutterInnerActive : s.shutterInner} />
        </button>

        <p
          style={{
            ...s.feedback,
            color: status === 'error' ? '#FFB4A8' : C.white,
          }}
        >
          {feedbackText}
        </p>
      </div>
    </div>
  );
}
