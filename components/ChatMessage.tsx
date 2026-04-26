
import React from 'react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

const MathIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
  </svg>
);

const UserIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);


export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isModel = message.role === 'model';
  
  const containerClasses = isModel ? 'justify-start' : 'justify-end';

  return (
    <div className={`flex items-end gap-3 ${containerClasses} animate-fade-in-up`}>
      {isModel && <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg"><MathIcon/></div>}
      <div className={`message-bubble ${isModel ? 'assistant' : 'user'}`}>
        {message.content && (
           <p className="whitespace-pre-wrap leading-relaxed">
              {message.content}
           </p>
        )}
        <div className="text-xs mt-2 opacity-50">
          {message.timestamp ? (() => {
            try {
              const date = new Date(message.timestamp);
              return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            } catch {
              return '';
            }
          })() : ''}
        </div>
      </div>
      {!isModel && <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg"><UserIcon/></div>}
    </div>
  );
};
