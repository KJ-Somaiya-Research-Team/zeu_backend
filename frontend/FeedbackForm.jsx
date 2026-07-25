import React, { useState } from 'react';

const StarIcon = ({ filled, onClick }) => (
  <svg 
    onClick={onClick}
    className={`w-8 h-8 cursor-pointer transition-colors ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300 stroke-current'}`} 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const getRatingDetails = (score) => {
  if (score === 0) return { text: "Rate your experience", emoji: "🙂" };
  if (score === 1) return { text: "My experience was terrible", emoji: "😞" };
  if (score === 2) return { text: "My experience was poor", emoji: "😕" };
  if (score === 3) return { text: "My experience was average", emoji: "😐" };
  if (score === 4) return { text: "My experience was good", emoji: "😊" };
  return { text: "My experience was excellent", emoji: "🤩" };
};

const FeedbackSection = ({ title, sectionId, data, onChange, onFileChange }) => {
  const { text, emoji } = getRatingDetails(data.rating);

  return (
    <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-6">{title}</h2>
      
      {/* Zomato-Style Rating Block */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[#1c2a38] mb-3">{text}</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon 
                key={star} 
                filled={data.rating >= star} 
                onClick={() => onChange(sectionId, 'rating', star)} 
              />
            ))}
          </div>
        </div>
        <div className="text-5xl text-yellow-400">
          {emoji}
        </div>
      </div>

      {/* Improvement & Image Upload Block */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <h3 className="text-md font-semibold text-[#1c2a38] mb-3">What can be improved?</h3>
        <textarea
          className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-yellow-400 outline-none resize-none mb-3"
          rows="3"
          placeholder="Tell us more about your experience..."
          value={data.feedbackText}
          onChange={(e) => onChange(sectionId, 'feedbackText', e.target.value)}
        ></textarea>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
            <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
            Attach Image
            <input 
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={(e) => onFileChange(sectionId, e.target.files[0])}
            />
          </label>
          {data.image && (
            <span className="text-sm text-green-600 font-medium truncate max-w-xs">
              ✓ {data.image.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ZeuFeedbackForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [feedbackData, setFeedbackData] = useState({
    chatbot: { rating: 0, feedbackText: '', image: null },
    app: { rating: 0, feedbackText: '', image: null },
    store: { rating: 0, feedbackText: '', image: null }
  });

  const handleChange = (section, field, value) => {
    setFeedbackData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Construct FormData for multipart/form-data upload
    const formData = new FormData();
    
    Object.keys(feedbackData).forEach(section => {
      formData.append(`${section}_rating`, feedbackData[section].rating);
      formData.append(`${section}_text`, feedbackData[section].feedbackText);
      if (feedbackData[section].image) {
        formData.append(`${section}_image`, feedbackData[section].image);
      }
    });

    try {
      // Assuming React app runs on a different port locally, adjust URL as needed.
      // On Vercel, this is simply '/api/feedback'
      const response = await fetch('/api/feedback', {
        method: 'POST',
        body: formData, // Browser automatically sets Content-Type to multipart/form-data with boundary
      });
      
      if (response.ok) {
        setSuccess(true);
      } else {
        alert("Failed to submit feedback.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Error connecting to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center mt-10">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
        <p className="text-gray-600">Your feedback helps us make Zeu better.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 bg-[#f8f9fb] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Order Feedback</h1>
        <p className="text-gray-600 mt-2">How was your grocery order experience with Zeu?</p>
      </div>

      <form onSubmit={handleSubmit}>
        <FeedbackSection 
          title="1. Chatbot Experience" 
          sectionId="chatbot"
          data={feedbackData.chatbot}
          onChange={handleChange}
          onFileChange={handleChange}
        />
        
        <FeedbackSection 
          title="2. Overall App Experience" 
          sectionId="app"
          data={feedbackData.app}
          onChange={handleChange}
          onFileChange={handleChange}
        />
        
        <FeedbackSection 
          title="3. Kirana Store & Order Improvement" 
          sectionId="store"
          data={feedbackData.store}
          onChange={handleChange}
          onFileChange={handleChange}
        />

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl text-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  );
}
