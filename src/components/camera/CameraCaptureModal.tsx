import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, SwitchCamera, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (file: File) => void;
  onFallbackToFile: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  onFallbackToFile,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      stopCamera();
      setCameraError(null);
      setIsPermissionDenied(false);
      setIsInitializing(true);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setIsInitializing(false);
        setCameraError(
          'In-browser camera access is not supported by your current browser. You can select an existing photo or use your device camera directly.'
        );
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }

        // Enumerate video devices for camera switching
        const allDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const cameras = allDevices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(cameras);

        if (!activeDeviceId && cameras.length > 0) {
          const currentTrack = mediaStream.getVideoTracks()[0];
          const currentSettings = currentTrack?.getSettings?.();
          setActiveDeviceId(currentSettings?.deviceId || cameras[0].deviceId);
        }

        setIsInitializing(false);
      } catch (err: unknown) {
        setIsInitializing(false);
        stopCamera();

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setIsPermissionDenied(true);
            setCameraError(
              'Camera permission was denied. Please grant camera permission in your browser or select an existing photo from your device.'
            );
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setCameraError(
              'No physical camera device was detected on your system. Please select a photo from your files.'
            );
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            setCameraError(
              'Your camera is currently in use by another application. Please close other camera apps and retry.'
            );
          } else {
            setCameraError(err.message || 'Unable to initialize device camera.');
          }
        } else {
          setCameraError('Unable to access device camera.');
        }
      }
    },
    [stopCamera, activeDeviceId]
  );

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleSwitchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    if (nextDevice) {
      setActiveDeviceId(nextDevice.deviceId);
      startCamera(nextDevice.deviceId);
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture frame from camera stream.');
          return;
        }

        const filename = `evidence-camera-${Date.now()}.jpg`;
        const capturedFile = new File([blob], filename, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        stopCamera();
        onPhotoCaptured(capturedFile);
        onClose();
      },
      'image/jpeg',
      0.92
    );
  };

  const handleFallback = () => {
    stopCamera();
    onClose();
    onFallbackToFile();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="Capture Photographic Evidence"
      description="Use your device camera to take an in-situ photo of the civic defect."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFallback}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload from Device
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                stopCamera();
                onClose();
              }}
            >
              Cancel
            </Button>
            {!cameraError && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCapturePhoto}
                disabled={isInitializing || !stream}
                leftIcon={<Camera className="h-4 w-4" />}
              >
                Snap Photo
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {cameraError ? (
          <div className="p-6 text-center space-y-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                {isPermissionDenied ? 'Camera Access Denied' : 'Camera Unavailable'}
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                {cameraError}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleFallback}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Select Photo from Files
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startCamera(activeDeviceId || undefined)}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Retry Camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-20 space-y-2">
                <RefreshCw className="h-6 w-6 text-sky-400 animate-spin" />
                <span className="text-xs text-slate-300 font-medium">Starting camera...</span>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlaid Controls */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              {videoDevices.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="bg-slate-900/80 hover:bg-slate-800 text-white p-2 rounded-full backdrop-blur-xs transition-colors"
                  title="Switch Camera"
                  aria-label="Switch Camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Camera Viewfinder Crosshair */}
            <div className="absolute inset-8 pointer-events-none border border-white/20 rounded-lg flex items-center justify-center">
              <div className="h-4 w-4 border-t border-l border-white/60 absolute top-0 left-0" />
              <div className="h-4 w-4 border-t border-r border-white/60 absolute top-0 right-0" />
              <div className="h-4 w-4 border-b border-l border-white/60 absolute bottom-0 left-0" />
              <div className="h-4 w-4 border-b border-r border-white/60 absolute bottom-0 right-0" />
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-500 text-center">
          Hold device steady and ensure the civic defect is in good lighting and focus before capturing.
        </p>
      </div>
    </Modal>
  );
};
