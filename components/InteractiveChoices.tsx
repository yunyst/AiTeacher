import React, { useState } from 'react';

interface InteractiveChoicesProps {
  choices: string[];
  onChoiceSelected: (choice: string) => void;
  multiCorrectAnswers?: string[] | null;
  onMultiChoiceSubmit?: (choices: string[]) => void;
  onSkip?: () => void;
}

export const InteractiveChoices: React.FC<InteractiveChoicesProps> = ({
  choices,
  onChoiceSelected,
  multiCorrectAnswers,
  onMultiChoiceSubmit,
  onSkip,
}) => {
  const isMulti = multiCorrectAnswers !== undefined && multiCorrectAnswers !== null;
  const [selected, setSelected] = useState<string[]>([]);

  const toggleOption = (choice: string) => {
    setSelected(prev =>
      prev.includes(choice) ? prev.filter(c => c !== choice) : [...prev, choice]
    );
  };

  const handleSubmit = () => {
    if (selected.length === 0) return;
    onMultiChoiceSubmit?.(selected);
    setSelected([]);
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <div className="p-4 border-t border-slate-700 bg-slate-900 animate-fade-in-up">
      <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
      `}</style>
      {isMulti && (
        <p className="text-xs text-slate-400 text-center mb-2">多选题：请选择所有正确答案</p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {choices.map((choice, index) => {
          if (isMulti) {
            const isChecked = selected.includes(choice);
            return (
              <button
                key={index}
                onClick={() => toggleOption(choice)}
                className={`font-semibold py-2 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                  isChecked
                    ? 'bg-cyan-500 text-white ring-2 ring-cyan-300'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 focus:ring-slate-500'
                }`}
              >
                {choice}
              </button>
            );
          }
          return (
            <button
              key={index}
              onClick={() => onChoiceSelected(choice)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
            >
              {choice}
            </button>
          );
        })}
      </div>
      {isMulti && (
        <div className="flex justify-center mt-3 gap-3">
          <button
            onClick={handleSkip}
            className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300 shadow-md"
          >
            跳过
          </button>
          <button
            onClick={handleSubmit}
            disabled={selected.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-2 px-8 rounded-lg transition-all duration-300 shadow-md"
          >
            提交答案
          </button>
        </div>
      )}
    </div>
  );
};
