import React, { memo } from 'react';

export interface WhisperFailureModalProps {
  open: boolean;
  onAcknowledge: () => void;
}

/**
 * Shown when Whisper transcription fails — gives the candidate a chance to
 * retry their voice answer. Pure presentational.
 */
const WhisperFailureModalImpl: React.FC<WhisperFailureModalProps> = ({ open, onAcknowledge }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="rounded-xl p-8 max-w-md w-full mx-4 bg-white">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🎤</div>
          <h3 className="text-2xl font-bold mb-2 text-red-500">Transcription Failed</h3>
          <p className="mb-4">Whisper transcription failed. Please try recording again.</p>
          <p className="text-sm text-gray-600">
            The 2-minute timer has been restarted. You can try recording your answer again.
          </p>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAcknowledge}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            OK, Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

export const WhisperFailureModal = memo(WhisperFailureModalImpl);
