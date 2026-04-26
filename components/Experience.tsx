import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Avatar } from './Avatar';
// FIX: Import the default avatar URL to satisfy the `avatarUrl` prop requirement of the `Avatar` component.
import { DEFAULT_AVATAR_URL } from '../constants';

const Loader = () => {
  return (
    <Html center>
      <div className="text-white text-xl animate-pulse">Loading Avatar...</div>
    </Html>
  );
};

export function Experience() {
  // Fix: The previous alias workaround for R3F elements was incorrect. We now use
  // the standard lowercase elements and have augmented the JSX namespace to make
  // TypeScript recognize them.
  return (
    <Canvas
      camera={{ position: [0, 0.5, 2], fov: 30 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#1E3A8A']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 3, 5]} intensity={1.5} />
      
      <Suspense fallback={<Loader />}>
        {/* FIX: Pass the required `avatarUrl` prop to the Avatar component to fix the missing property error. */}
        <Avatar avatarUrl={DEFAULT_AVATAR_URL} />
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