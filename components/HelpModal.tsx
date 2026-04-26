import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="flex items-start space-x-4 p-3 bg-slate-700/50 rounded-lg">
        <div className="flex-shrink-0 text-cyan-400 mt-1 w-6 h-6">{icon}</div>
        <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-300">{children}</p>
        </div>
    </div>
);

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <style>{`
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
      <div className="bg-slate-800 rounded-lg shadow-2xl p-6 max-w-md w-11/12 relative text-slate-300" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-cyan-400">应用介绍</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 transition-colors" aria-label="关闭介绍">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <Section 
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                } 
                title="选择课程"
            >
                点击左上角的菜单图标，可以打开课程列表。在这里，你可以按类别浏览并选择你感兴趣的课程。
            </Section>
            <Section 
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                } 
                title="自定义形象"
            >
                点击右上角的魔法棒图标，可以创建和定制你自己的虚拟导师形象，让学习体验更具个性化。
            </Section>
            <Section 
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 5.523-4.477 10-10 10S1 17.523 1 12 5.477 2 11 2s10 4.477 10 10z" />
                    </svg>
                }
                title="互动对话"
            >
                主窗口是你的学习区域。导师会在这里通过文字和你交流，并同步进行语音讲解，带来沉浸式学习体验。
            </Section>
            <Section 
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                } 
                title="文字输入与选择"
            >
                在课程进行中，你可以在底部的输入框回答问题。当出现选择题时，请直接点击下方出现的选项按钮进行互动。
            </Section>
        </div>
      </div>
    </div>
  );
};
