import React, { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { SkinnedMesh, Object3D, MathUtils } from 'three';
import { useAppStore } from '../store/useAppStore';
import { HEAD_BONE_NAME } from '../constants';

export function Avatar({ avatarUrl }: { avatarUrl: string }) {
  useGLTF.preload(avatarUrl);
  const { scene } = useGLTF(avatarUrl);
  
  const setIsReady = useAppStore((state) => state.setIsReady);
  const setAvailableBlendshapes = useAppStore((state) => state.setAvailableBlendshapes);

  const { head, meshesWithMorphTargets } = useMemo(() => {
    let head: Object3D | undefined;
    const meshesWithMorphTargets: SkinnedMesh[] = [];

    scene.traverse((object) => {
      if (object.name === HEAD_BONE_NAME) {
        head = object;
      }
      // Robustly find any skinned mesh with morph targets, regardless of name
      if (object instanceof SkinnedMesh && object.morphTargetInfluences) {
        if (object.morphTargetInfluences.length > 0) {
            meshesWithMorphTargets.push(object);
        }
      }
    });

    return { head, meshesWithMorphTargets };
  }, [scene]);
  
  useEffect(() => {
    setIsReady(true);
    let blendshapeNames: string[] = [];
    // Use the first mesh found to source the blendshape names.
    // This assumes all meshes with morph targets share the same blendshape set.
    const mainMesh = meshesWithMorphTargets[0];

    if (mainMesh) {
      // Method 1: Best case, check for the dictionary
      if (mainMesh.morphTargetDictionary) {
        blendshapeNames = Object.keys(mainMesh.morphTargetDictionary);
      } 
      // Method 2: Standard GLTF location for morph target names
      else if (mainMesh.geometry.userData.targetNames?.length > 0) {
        blendshapeNames = mainMesh.geometry.userData.targetNames;
      }
      // Method 3: Last resort, generate generic names if influences array exists
      else if (mainMesh.morphTargetInfluences) {
        blendshapeNames = mainMesh.morphTargetInfluences.map((_, index) => `blendshape_${index}`);
      }
    }

    setAvailableBlendshapes(blendshapeNames);
    
    return () => {
      setIsReady(false);
      setAvailableBlendshapes([]); 
    };
  }, [setIsReady, meshesWithMorphTargets, setAvailableBlendshapes]);


  const blinkLogic = React.useRef({ nextBlink: 0, isBlinking: false });

  useFrame((state, delta) => {
    const { blendshapes, isSpeaking, availableBlendshapes } = useAppStore.getState();
    const smoothing = 15;

    if (head) {
      if (isSpeaking) {
        // Lock head position to zero when speaking
        head.rotation.x = 0;
        head.rotation.y = 0;
        head.rotation.z = 0;
      } else {
        // Apply a gentle sway when idle
        const t = state.clock.getElapsedTime();
        const targetHeadRotation = {
          x: Math.sin(t * 0.5) * 0.015,
          y: Math.cos(t * 0.3) * 0.01,
          z: Math.sin(t * 0.4) * 0.005,
        };
        head.rotation.x = MathUtils.lerp(head.rotation.x, targetHeadRotation.x, smoothing * delta);
        head.rotation.y = MathUtils.lerp(head.rotation.y, targetHeadRotation.y, smoothing * delta);
        head.rotation.z = MathUtils.lerp(head.rotation.z, targetHeadRotation.z, smoothing * delta);
      }
    }
    
    if (meshesWithMorphTargets.length === 0) {
        return;
    }

    // --- Blinking (remains unchanged) ---
    const t = state.clock.getElapsedTime();
    if (t > blinkLogic.current.nextBlink) {
      blinkLogic.current.isBlinking = true;
      setTimeout(() => {
        blinkLogic.current.isBlinking = false;
      }, 120);
      blinkLogic.current.nextBlink = t + Math.random() * 4 + 2;
    }

    const finalBlendshapes = { ...blendshapes };
    if (blinkLogic.current.isBlinking) {
      finalBlendshapes['eyeBlinkLeft'] = 1;
      finalBlendshapes['eyeBlinkRight'] = 1;
    }

    // --- Apply Blendshapes ---
    meshesWithMorphTargets.forEach(mesh => {
        if (!mesh.morphTargetInfluences) return;

        const dictionary = mesh.morphTargetDictionary || 
                         (mesh.geometry.userData.targetNames 
                            ? Object.fromEntries(mesh.geometry.userData.targetNames.map((name: string, i: number) => [name, i])) 
                            : Object.fromEntries(availableBlendshapes.map((name, i) => [name, i])));

        Object.keys(finalBlendshapes).forEach((shapeName) => {
            const index = dictionary[shapeName];
            if (index !== undefined) {
                const targetValue = finalBlendshapes[shapeName] ?? 0;
                mesh.morphTargetInfluences![index] = MathUtils.lerp(
                    mesh.morphTargetInfluences![index],
                    targetValue,
                    smoothing * delta
                );
            }
        });
    });
  });

  // Fix: The previous alias workaround for R3F elements was incorrect. We now use
  // the standard lowercase element, <primitive>, and have augmented the JSX namespace
  // to make TypeScript recognize it.
  return <primitive object={scene} position={[0, -1.2, 0]} />;
}