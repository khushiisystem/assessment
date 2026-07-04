import { useState } from "react"
import { CheckCircle2, Star, X } from "lucide-react"

interface FeedbackPopupProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rating: number, feedbackText: string) => Promise<void>
  isSubmitting?: boolean
}

const FeedbackPopup = ({ isOpen, onClose, onSubmit, isSubmitting = false }: FeedbackPopupProps) => {
  const [rating, setRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState("")
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) {
      setRatingError(true)
      return
    }

    setRatingError(false)
    setLocalSubmitting(true)
    try {
      await onSubmit(rating, feedbackText)
      setRating(0)
      setFeedbackText("")
      onClose()
    } catch (error) {
      console.error("Feedback submission error:", error)
    } finally {
      setLocalSubmitting(false)
    }
  }

  const isLoading = isSubmitting || localSubmitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border-2 border-green-600 outline outline-4 outline-green-100">

        {/* Skip Button - Top Right */}
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 rounded-full px-3 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-3 h-3" />
            Skip
          </button>
        </div>

        {/* Header */}
        <div className="text-center pt-2 pb-2 px-5">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Assessment Completed!</h2>
          <p className="text-slate-500 text-sm mt-1">
            Thank you for completing the assessment.
          </p>
        </div>

        {/* Instruction - Yellow Box */}
        <div className="bg-amber-50 mx-5 my-2 rounded-lg p-2.5 text-center border border-amber-100">
          <p className="text-amber-700 text-xs font-medium">
            Please share your feedback before viewing results
          </p>
        </div>

        {/* Rating Section */}
        <div className="px-5 pt-3">
          <label className="block text-sm font-medium text-slate-700 mb-2 text-center">
            How was your experience?{" "}
            <span className="text-red-500">*</span>
          </label>

          {/* Stars */}
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setRating(star)
                  setRatingError(false)
                }}
                disabled={isLoading}
                className="focus:outline-none transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Star
                  className={`h-7 w-7 ${
                    star <= rating
                      ? "text-yellow-400 fill-yellow-400"
                      : ratingError
                      ? "text-red-300"
                      : "text-gray-300"
                  } transition-colors`}
                />
              </button>
            ))}
          </div>

          {/* Rating Error Message */}
          {ratingError && (
            <p className="text-center text-xs text-red-500 mt-1.5">
              Please select a rating to submit feedback
            </p>
          )}
        </div>

        {/* Dynamic Rating Text */}
        {rating > 0 && (
          <div className="px-5 pt-2 pb-1 text-center">
            <span className="text-sm font-medium text-blue-600">
              {rating === 1 && "Very Poor"}
              {rating === 2 && "Poor"}
              {rating === 3 && "Average"}
              {rating === 4 && "Good"}
              {rating === 5 && "Excellent!"}
            </span>
          </div>
        )}

        {/* Comments Section */}
        <div className="px-5 pt-3">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Comment{" "}
            <span className="text-slate-400 text-xs font-normal">(Optional)</span>
          </label>
          <textarea
            placeholder="Enter comment..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            disabled={isLoading}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="text-right text-xs text-slate-400 mt-1">
            {feedbackText.length}/500
          </div>
        </div>

        {/* Action Button */}
        <div className="px-5 pt-2 pb-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium text-sm disabled:bg-blue-300 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Submitting...</span>
              </div>
            ) : (
              "Submit Feedback & View Results"
            )}
          </button>
        </div>

        {/* Footer Note */}
        <div className="border-t border-gray-100 px-5 py-3 bg-white">
          <p className="text-center text-xs text-slate-400">
            Your feedback is anonymous and helps us improve
          </p>
        </div>
      </div>
    </div>
  )
}

export default FeedbackPopup