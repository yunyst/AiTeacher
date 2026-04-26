import React, { useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Avatar } from './Avatar';
import { useAppStore } from '../store/useAppStore';

const Loader = () => (
  <Html center>
    <div className="text-white text-xl animate-pulse">Loading Avatar...</div>
  </Html>
);

interface InteractiveAvatarProps {
  textToSpeak: string;
  onSpeechEnd: () => void;
  avatarUrl: string;
}

export function InteractiveAvatar({ textToSpeak, onSpeechEnd, avatarUrl }: InteractiveAvatarProps) {
  const speakSentence = useAppStore((state) => state.speakSentence);
  const isReady = useAppStore((state) => state.isReady);
  
  // Effect to trigger speech when the textToSpeak prop changes
  useEffect(() => {
    if (textToSpeak && isReady) {
      speakSentence(textToSpeak);
    }
  }, [textToSpeak, isReady, speakSentence]);

  // Effect to subscribe to the store and notify the parent when speech ends
  useEffect(() => {
    // Fix: The default `subscribe` method takes a single listener `(state, prevState) => void`.
    // It does not support a selector as the first argument without using the `subscribeWithSelector` middleware.
    const unsub = useAppStore.subscribe(
      (state, prevState) => {
        if (prevState.isSpeakingSentence && !state.isSpeakingSentence && onSpeechEnd) {
          onSpeechEnd();
        }
      }
    );
    return unsub;
  }, [onSpeechEnd]);

  // Fix: The previous alias workaround for R3F elements was incorrect. We now use
  // the standard lowercase elements and have augmented the JSX namespace to make
  // TypeScript recognize them.
  return (
    <Canvas
      camera={{ position: [0, 0.5, 1], fov: 30 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#1E3A8A']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 3, 5]} intensity={1.5} />
      
      <Suspense fallback={<Loader />}>
        {/* FIX: Removed the `key` prop which was causing a type error as it's not defined in the Avatar's props. */}
        <Avatar avatarUrl={avatarUrl} />
      </Suspense>
      
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        target={[0, 0.5, 0]}
        minDistance={1}
        maxDistance={4}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
}