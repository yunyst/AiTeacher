import { useEffect, useRef } from "react";
import { Euler } from "three";
import { useAppStore } from "../store/useAppStore";

export const useHeadRotation = () => {
  // FIX: The property `setHeadRotation` did not exist on the AppState.
  // It has been corrected to `setHeadBobOffset` to align with the store's definition.
  const setHeadBobOffset = useAppStore((state) => state.setHeadBobOffset);
  const isRightMouseDown = useRef(false);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isRightMouseDown.current) return;

      const { clientX, clientY } = event;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * Math.PI * 0.2;
      const y = (clientY / innerHeight - 0.5) * Math.PI * 0.2;
      setHeadBobOffset(new Euler(-y, x, 0, "XYZ"));
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) { // Right mouse button
        isRightMouseDown.current = true;
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2) { // Right mouse button
        isRightMouseDown.current = false;
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [setHeadBobOffset]);
};
