import { useEffect, useRef, type RefObject } from 'react';

export interface UseCameraOpts {
  /** Master gate — `assessmentData?.enable_camera && isAssessmentStarted` in the original. */
  enabled: boolean;
  /** The <video> element the live stream is bound to. */
  videoRef: RefObject<HTMLVideoElement>;
  /** Current camera stream (closure-captured by the cleanup branch — mirrors the original behaviour). */
  cameraStream: MediaStream | null;
  /** Parent state setters — the hook calls these as it acquires (or fails to acquire) the stream. */
  setCameraStream: (stream: MediaStream | null) => void;
  setIsCameraActive: (v: boolean) => void;
  setCameraError: (msg: string) => void;
  setIsProctoringActive: (v: boolean) => void;
  /** Called once the live stream is acquired — used to kick off proctoring init. */
  onStreamReady: (stream: MediaStream) => void;
  /** Additional cleanup the parent wants to chain alongside camera track-stop (timers, media recorders). */
  onCleanupExtra?: () => void;
  /** Extra deps for the srcObject rebind effect — parents pass things like `cameraSize` so the bind survives layout swaps. */
  rebindDeps?: ReadonlyArray<unknown>;
}

/**
 * Camera lifecycle hook — owns the `getUserMedia` initialization and the
 * <video> rebind effect that used to live inline in AiAssessmentTestInterface.
 *
 * Faithfully preserves the original behaviour, including the closure-captured
 * `cameraStream` in the cleanup branch and the manual `onStreamReady` callout
 * (which the parent wires to proctoring init).
 *
 * Callbacks (`onStreamReady`, `onCleanupExtra`) are stored in refs so the
 * effect doesn't re-run on every parent render — useful while the parent's
 * other state (currently ~50 useState slots) churns.
 */
export function useCamera({
  enabled,
  videoRef,
  cameraStream,
  setCameraStream,
  setIsCameraActive,
  setCameraError,
  setIsProctoringActive,
  onStreamReady,
  onCleanupExtra,
  rebindDeps = [],
}: UseCameraOpts): void {
  // Keep the latest callback identities in refs — decouples re-run cadence
  // from parent render cadence.
  const onStreamReadyRef = useRef(onStreamReady);
  const onCleanupExtraRef = useRef(onCleanupExtra);
  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  }, [onStreamReady]);
  useEffect(() => {
    onCleanupExtraRef.current = onCleanupExtra;
  }, [onCleanupExtra]);

  // ===== INITIALIZATION =====
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        setIsProctoringActive(true);
        setCameraError('');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        onStreamReadyRef.current(stream);
      } catch (err: unknown) {
        // Preserve the original console.error so debug visibility is unchanged.
        console.error('Error accessing camera:', err);
        const message = err instanceof Error ? err.message : 'Unable to access camera';
        setCameraError(message);
        setIsCameraActive(false);
        setIsProctoringActive(false);
      }
    };

    if (enabled) {
      initializeCamera();
    }

    return () => {
      // Read `cameraStream` from the enclosing closure — matches the original
      // pattern exactly (the cleanup ran with whatever stream had been written
      // to state by the previous effect cycle).
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      onCleanupExtraRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors the
    // original's dep array, intentionally excluding `cameraStream` and the
    // setter identities (which never change for setState-derived setters).
  }, [enabled]);

  // ===== SRCOBJECT REBIND =====
  // Re-attaches the live stream whenever the <video> element re-mounts (layout
  // swaps move the node around, leaving the new element without srcObject).
  useEffect(() => {
    const v = videoRef.current;
    if (v && cameraStream && v.srcObject !== cameraStream) {
      v.srcObject = cameraStream;
      v.play?.().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rebindDeps` is a
    // stable contract from the parent; spreading it produces the identical
    // dep array the inline effect used.
  }, [cameraStream, ...rebindDeps]);
}
