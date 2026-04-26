
import React from 'react';

interface VirtualTutorProps {
  isSpeaking: boolean;
}

export const VirtualTutor: React.FC<VirtualTutorProps> = ({ isSpeaking }) => {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full bg-slate-900 p-8 border-r border-slate-800">
      <div className="relative w-64 h-64 lg:w-80 lg:h-80">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
          <defs>
            <radialGradient id="grad-body" cx="50%" cy="40%" r="60%" fx="50%" fy="40%">
              <stop offset="0%" style={{stopColor: '#67e8f9', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#0e7490', stopOpacity: 1}} />
            </radialGradient>
             <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="100" cy="100" r="70" fill="url(#grad-body)" />
          
          <g className="eyes">
            <circle cx="80" cy="90" r="12" fill="white" />
            <circle cx="120" cy="90" r="12" fill="white" />
            <circle cx="80" cy="90" r="6" fill="#082f49" className="pupil" />
            <circle cx="120" cy="90" r="6" fill="#082f49" className="pupil" />
          </g>

          <path
            d="M 90 125 Q 100 130 110 125"
            stroke="white"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            className={`mouth ${isSpeaking ? 'speaking' : ''}`}
          />

           <g style={{filter: 'url(#glow)'}}>
            <line x1="100" y1="30" x2="100" y2="10" stroke="#67e8f9" strokeWidth="3" />
            <circle cx="100" cy="10" r="5" fill="#67e8f9" className={isSpeaking ? 'antenna-light-speaking' : 'antenna-light-idle'}/>
           </g>

        </svg>
      </div>
      
      <style>{`
        .pupil {
          animation: blink 4s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 95%, 100% { transform: scaleY(1) translateY(0); }
          97.5% { transform: scaleY(0.1) translateY(0); }
        }
        .mouth.speaking {
          animation: talk 0.4s ease-in-out infinite alternate;
        }
        @keyframes talk {
          from { d: path("M 90 125 Q 100 128 110 125"); }
          to { d: path("M 90 125 Q 100 140 110 125"); }
        }
        .antenna-light-idle {
          animation: pulse-idle 2s infinite;
        }
        .antenna-light-speaking {
          animation: pulse-speaking 0.5s infinite;
        }
        @keyframes pulse-idle {
          0% { r: 5; opacity: 0.7; }
          50% { r: 6; opacity: 1; }
          100% { r: 5; opacity: 0.7; }
        }
         @keyframes pulse-speaking {
          0% { r: 5; opacity: 0.8; }
          50% { r: 7; opacity: 1; }
          100% { r: 5; opacity: 0.8; }
        }
      `}</style>

      <div className="text-center mt-6">
        <h2 className="text-xl font-bold text-slate-200">
          {isSpeaking ? '正在讲解中...' : '虚拟数学导师'}
        </h2>
        <p className="text-slate-400 text-sm">由 Gemini 强力驱动</p>
      </div>
    </div>
  );
};
