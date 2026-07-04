import React from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import {
  ArrowLeft,
  Printer,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export const AssessmentCandidateSubmission = () => {
  const submissionData = {
    candidateName: "jay pratap",
    assessmentName: "Python-01",
    overallScore: "50.0%",
    correctAnswered: "10/12",
    questionsAttempted: "10/12",
    timeTaken: "00:14:47"
  };

  const [expandedQuestion, setExpandedQuestion] = React.useState("1");
  const navigate = useNavigate();

  const questions = [
    {
      id: "Q1",
      text: "What will be the output of the following code?",
      code: "def add_items(list1=[1], list1_args[0]): return list1.pop(last_items[0], principal_items[0], principal_items[1])",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "B",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q2",
      text: "What is the output of the following code?",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q3",
      text: "Which of the following is not a valid set operation",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q4",
      text: "Which of the following is used to create an anonymous...",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q5",
      text: "Which method is used to get all keys from a...",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q6",
      text: "What is the output of...",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q7",
      text: "What is the result of this code?",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q8",
      text: "Which of the following can be used to create a...",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q9",
      text: "Which of the following are valid ways to define a...",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q10",
      text: "Which of the following statements about Python tuples are true?",
      type: "MCQ (Single Correct)",
      difficulty: "Easy",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Correct",
      marks: "1/1"
    },
    {
      id: "Q11",
      text: "Count Frequency of Words in a String",
      type: "Coding",
      difficulty: "Medium",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Incorrect",
      marks: "0/4"
    },
    {
      id: "Q12",
      text: "Take input an array, move all zeroes to the end...",
      type: "Coding",
      difficulty: "Hard",
      candidateAnswer: "",
      correctAnswer: "",
      status: "Incorrect",
      marks: "0/3"
    }
  ];

  const getStatusColor = (status: string) => {
    return status === "Correct" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? "" : questionId);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-slate-800">
            {submissionData.candidateName}'s Submissions
            <span className="text-slate-500 font-normal ml-1">- {submissionData.assessmentName}</span>
          </h1>
          <div className="flex gap-1">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-0.5 px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 transition-all duration-200 text-slate-700 text-xs"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Results
            </button>
            <button className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 text-xs">
              <Printer className="w-3 h-3" />
              Print Submission
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Overall Score", value: submissionData.overallScore, color: "text-blue-600" },
            { label: "Correct Answered", value: submissionData.correctAnswered, color: "text-green-600" },
            { label: "Questions Attempted", value: submissionData.questionsAttempted, color: "text-cyan-600" },
            { label: "Time Taken", value: submissionData.timeTaken, color: "text-orange-600" }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded shadow-sm border border-gray-200 p-3 text-center">
              <div className={`text-lg font-bold ${stat.color} mb-1`}>
                {stat.value}
              </div>
              <div className="text-xs text-slate-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Question-wise Submissions */}
        <div className="bg-white rounded shadow-sm border border-gray-200">
          <div className="p-4">
            <h2 className="text-sm font-medium mb-3 text-slate-800">Question-wise Submissions</h2>

            <div className="space-y-2">
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded overflow-hidden">
                  <button
                    onClick={() => toggleQuestion(question.id)}
                    className="flex items-center justify-between w-full p-3 bg-white hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-xs text-slate-800 min-w-[30px]">{question.id}:</span>
                      <span className="text-xs text-slate-700 flex-1 truncate">{question.text}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(question.status)}`}>
                        {question.status}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                        {question.marks}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-500 transition-transform ${expandedQuestion === question.id ? 'rotate-180' : ''
                          }`}
                      />
                    </div>
                  </button>

                  {expandedQuestion === question.id && (
                    <div className="p-3 bg-slate-50 border-t border-gray-200 space-y-3">
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <h4 className="font-medium mb-1 text-xs text-slate-800">Question:</h4>
                        <p className="text-xs text-slate-700 mb-2">{question.text}</p>
                        {question.code && (
                          <pre className="bg-slate-100 p-2 rounded text-xs overflow-x-auto border border-gray-200">
                            <code className="text-slate-800">{question.code}</code>
                          </pre>
                        )}
                      </div>

                      {question.candidateAnswer && (
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <h4 className="font-medium mb-1 text-xs text-slate-800">Candidate's Answer:</h4>
                          <p className="text-xs text-slate-700">{question.candidateAnswer}</p>
                        </div>
                      )}

                      {question.correctAnswer && (
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <h4 className="font-medium mb-1 text-xs text-slate-800">Correct Answer:</h4>
                          <p className="text-xs text-slate-700">{question.correctAnswer}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-600">Question Type:</span>
                          <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                            {question.type.includes("MCQ") ? "MCQ" : "Coding"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-600">Difficulty:</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-1 mt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-0.5 px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 transition-all duration-200 text-slate-700 text-xs"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Results
          </button>
          <button className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 text-xs">
            <Printer className="w-3 h-3" />
            Print Submission
          </button>
        </div>
        </div>
      </div>
    </AdminLayout>
  );
};
