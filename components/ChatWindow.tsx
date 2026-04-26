
import React, { useLayoutEffect, useRef } from 'react';
import type { Message } from '../types';
import { ChatMessage } from './ChatMessage';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Always scroll to the bottom when messages change to show the latest.
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showTypingIndicator = isLoading && (messages.length === 0 || messages[messages.length - 1].role === 'user');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-float shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold modern-title">开始学习之旅</h3>
            <p className="text-white/50">选择课程开始与AI导师的互动</p>
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {showTypingIndicator && (
        <div className="flex justify-start animate-fade-in-up">
            <div className="glass-card rounded-2xl rounded-bl-md p-4 max-w-lg">
                <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
            </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
