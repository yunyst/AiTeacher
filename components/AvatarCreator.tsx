import React, { useEffect, useCallback } from 'react';

interface AvatarCreatorProps {
  onAvatarExported: (url: string) => void;
  onClose: () => void;
}

const subdomain = 'demo'; // Using the demo subdomain for Ready Player Me
const iFrameSrc = `https://${subdomain}.readyplayer.me/avatar?frameApi`;

export const AvatarCreator: React.FC<AvatarCreatorProps> = ({ onAvatarExported, onClose }) => {
  const handleAvatarUrl = useCallback((url: string) => {
    onAvatarExported(url);
  }, [onAvatarExported]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // The iframe can send a raw URL string or a JSON object.
      // First, handle the raw URL string case, which is likely causing the JSON parse error.
      if (typeof event.data === 'string' && event.data.startsWith('http')) {
        handleAvatarUrl(event.data);
        return;
      }

      try {
        const json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (json?.source !== 'readyplayerme') {
          return;
        }
        
        // Subscribe to all events from Ready Player Me Frame when it's ready
        if (json.eventName === 'v1.frame.ready') {
          const frame = document.getElementById('rpm-iframe') as HTMLIFrameElement;
          if (frame?.contentWindow) {
            frame.contentWindow.postMessage(
              JSON.stringify({
                target: 'readyplayerme',
                type: 'subscribe',
                eventName: 'v1.**',
              }),
              '*'
            );
          }
        }

        // Handle the avatar exported event from the structured message
        if (json.eventName === 'v1.avatar.exported') {
           handleAvatarUrl(json.data.url);
        }

      } catch (error) {
        // This will now only catch errors for strings that are not URLs but also not valid JSON.
        // It's safe to ignore these as they are not messages we are interested in.
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleAvatarUrl]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center backdrop-blur-sm animate-fade-in">
       <style>{`
        @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-slate-800 rounded-lg shadow-2xl overflow-hidden">
        <iframe
          id="rpm-iframe"
          title="Ready Player Me Avatar Creator"
          className="w-full h-full border-0"
          src={iFrameSrc}
          allow="camera *; microphone *"
        ></iframe>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-slate-900 hover:bg-red-700 text-white font-bold w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 z-10 text-2xl transform hover:scale-110"
          aria-label="Close avatar creator"
        >
          &times;
        </button>
      </div>
    </div>
  );
};