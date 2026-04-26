import React, { useEffect, useRef, useState, useLayoutEffect, useMemo } from 'react';
import type { PDFDocumentProxy, RenderTask, PageViewport } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import * as katex from 'katex';
import 'katex/dist/katex.min.css';
import type { BlackboardContent, DrawingOperation } from '../types';

interface BlackboardProps {
  content: BlackboardContent;
  drawingState: {
    operations: DrawingOperation[];
    background: 'black' | 'white' | 'transparent';
  };
  onPageChange: (newPage: number) => void;
  onVideoEnded: () => void;
  isPaused: boolean;
}

// A component to render LaTeX strings using the local KaTeX library.
const KatexRenderer: React.FC<{
  formula: string;
  color?: string;
  fontSize?: number;
  displayMode?: boolean;
}> = ({ formula, color, fontSize, displayMode = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Effect to render the formula when ready
  useEffect(() => {
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = ''; // Clear previous content
        setRenderError(null); // Clear previous errors

        // Check if formula is empty or only whitespace
        if (!formula || formula.trim() === '') {
          return;
        }

        // Validate formula before rendering
        if (typeof formula !== 'string') {
          throw new Error('Formula must be a string');
        }

        // Enhanced KaTeX rendering with better error handling
        katex.render(formula, containerRef.current, {
          throwOnError: true, // Changed to true to catch errors
          displayMode: displayMode,
          strict: false, // Allow some flexibility in LaTeX syntax
          trust: true, // Allow more HTML in user input
          macros: {
              "\\f": "#1f(#2)", // Common math macros
              "\\N": "\\mathbb{N}",
              "\\Z": "\\mathbb{Z}",
              "\\Q": "\\mathbb{Q}",
              "\\R": "\\mathbb{R}",
              "\\C": "\\mathbb{C}"
          }
        });
      } catch (e: any) {
        console.error('[KatexRenderer] KaTeX render error:', e);
        setRenderError(e?.message || 'Unknown rendering error');

        // Fallback rendering: show original formula with error styling
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          const fallbackSpan = document.createElement('span');
          fallbackSpan.className = 'katex-fallback';
          fallbackSpan.textContent = formula;
          containerRef.current.appendChild(fallbackSpan);
        }
      }
    }
  }, [formula, color, fontSize, displayMode]);

  const style = {
    fontSize: `${fontSize || 16}px`,
    color: renderError ? '#ff6b6b' : color || 'white',
    lineHeight: 1.2,
  };

  // Determine CSS classes based on status
  const getClassName = () => {
    const baseClasses = ['katex-renderer'];
    if (renderError) baseClasses.push('katex-error');
    return baseClasses.join(' ');
  };

  // Render fallback text with error states
  return (
    <div
      ref={containerRef}
      style={style}
      className={getClassName()}
      title={renderError || undefined}
    >
      {renderError && (
        <span className="katex-error">
          KaTeX Error: {formula}
        </span>
      )}
    </div>
  );
};


export const Blackboard: React.FC<BlackboardProps> = ({ content, drawingState, onPageChange, onVideoEnded, isPaused }) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        // Handle play() promise rejection (e.g., autoplay policy)
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn('[Blackboard] Video play failed:', error);
            // Only log if not caused by our own pause call
            if (error.name !== 'AbortError') {
              console.error('[Blackboard] Video play error (not AbortError):', error);
            }
          });
        }
      }
    }
  }, [isPaused]);

  const textOperations = drawingState.operations.filter((op): op is Extract<DrawingOperation, { type: 'text' }> => op.type === 'text');
  const shapeOperations = drawingState.operations.filter(op => op.type !== 'text' && op.type !== 'background' && op.type !== 'clear');
  
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const managePdfLifecycle = async () => {
      if (content?.type !== 'pdf') {
        if (pdfDocRef.current) {
          await pdfDocRef.current.destroy();
          pdfDocRef.current = null;
        }
        if (!isCancelled) setNumPages(0);
        return;
      }
      const { url, page } = content;
      if (!isCancelled) {
        setIsLoading(true);
        setError(null);
      }
      try {
        if (!pdfDocRef.current || pdfDocRef.current.loadingParams.url !== url) {
          if (pdfDocRef.current) await pdfDocRef.current.destroy();
          const loadingTask = pdfjsLib.getDocument(url);
          const doc = await loadingTask.promise;
          if (isCancelled) { doc.destroy(); return; }
          pdfDocRef.current = doc;
          if (!isCancelled) setNumPages(doc.numPages);
        }
        const doc = pdfDocRef.current;
        if (!doc) throw new Error("PDF Document not loaded.");
        if (page < 1 || page > doc.numPages) throw new Error(`Page ${page} is out of bounds (1-${doc.numPages}).`);
        const canvas = pdfCanvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        
        const pdfPage = await doc.getPage(page);
        if (isCancelled) return;
        const dpr = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(containerSize.width / viewport.width, containerSize.height / viewport.height);
        const scaledViewport: PageViewport = pdfPage.getViewport({ scale: scale * dpr });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${scaledViewport.width / dpr}px`;
        canvas.style.height = `${scaledViewport.height / dpr}px`;
        // FIX: Add the `canvas` property to satisfy the type definition for RenderParameters,
        // which appears to be out of sync with the runtime library. The `canvasContext`
        // property is preserved as it's required by the modern pdf.js runtime.
        renderTaskRef.current = pdfPage.render({ canvasContext: context, viewport: scaledViewport } as any);
        await renderTaskRef.current.promise;
      } catch (err: any) {
        if (!isCancelled && err.name !== 'RenderingCancelledException') {
          console.error('Failed to render PDF:', err);
          setError(err.message || 'Failed to load PDF.');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
        renderTaskRef.current = null;
      }
    };
    if (containerSize.width > 0 && containerSize.height > 0) managePdfLifecycle();
    return () => {
      isCancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [content, containerSize]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.width * dpr;
    canvas.height = containerSize.height * dpr;
    canvas.style.width = `${containerSize.width}px`;
    canvas.style.height = `${containerSize.height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, containerSize.width, containerSize.height);

    shapeOperations.forEach(op => {
      switch (op.type) {
        case 'line':
          ctx.beginPath();
          ctx.moveTo(op.x1 / 100 * containerSize.width, op.y1 / 100 * containerSize.height);
          ctx.lineTo(op.x2 / 100 * containerSize.width, op.y2 / 100 * containerSize.height);
          ctx.strokeStyle = op.color || 'white';
          ctx.lineWidth = op.lineWidth || 1;
          ctx.stroke();
          break;
        case 'rect':
          ctx.beginPath();
          ctx.rect(op.x / 100 * containerSize.width, op.y / 100 * containerSize.height, op.width / 100 * containerSize.width, op.height / 100 * containerSize.height);
          if (op.fill) {
            ctx.fillStyle = op.fill;
            ctx.fill();
          }
          if (op.color) {
            ctx.strokeStyle = op.color;
            ctx.lineWidth = op.lineWidth || 1;
            ctx.stroke();
          }
          break;
        case 'circle':
          const radius = op.radius / 100 * Math.min(containerSize.width, containerSize.height);
          ctx.beginPath();
          ctx.arc(op.cx / 100 * containerSize.width, op.cy / 100 * containerSize.height, radius, 0, 2 * Math.PI);
          if (op.fill) {
            ctx.fillStyle = op.fill;
            ctx.fill();
          }
          if (op.color) {
            ctx.strokeStyle = op.color;
            ctx.lineWidth = op.lineWidth || 1;
            ctx.stroke();
          }
          break;
      }
    });
  }, [shapeOperations, containerSize]);

  const showPdf = content?.type === 'pdf' && drawingState.background === 'transparent';
  const showVideo = content?.type === 'video' && drawingState.background === 'transparent';
  const backgroundClass = drawingState.background === 'black' ? 'bg-black' : drawingState.background === 'white' ? 'bg-white' : 'bg-transparent';
  
  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      
      <div className={`absolute inset-0 transition-colors duration-300 ${backgroundClass}`}></div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-white text-lg">Loading PDF...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-80 p-4 z-10">
          <p className="text-white text-center">Error: {error}</p>
        </div>
      )}

      {showVideo && content && 'url' in content && (
        <video 
          ref={videoRef}
          key={content.url} 
          src={content.url} 
          controls 
          autoPlay={!isPaused}
          onEnded={onVideoEnded}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      <canvas ref={pdfCanvasRef} className={`${showPdf ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
      
      {showPdf && numPages > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 rounded-full px-4 py-2 flex items-center gap-4 text-white z-20">
          <button onClick={() => onPageChange(content.page - 1)} disabled={content.page <= 1} className="disabled:opacity-50">&lt;</button>
          <span>Page {content.page} of {numPages}</span>
          <button onClick={() => onPageChange(content.page + 1)} disabled={content.page >= numPages} className="disabled:opacity-50">&gt;</button>
        </div>
      )}

      <canvas ref={drawingCanvasRef} className="absolute top-0 left-0" />

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {textOperations.map((op, index) => {
          return (
            <div
              key={index}
              className="absolute"
              style={{
                left: `${op.x}%`,
                top: `${op.y}%`,
                transform: 'translate(-50%, -50%)',
                color: op.color || 'white',
              }}
            >
              <KatexRenderer formula={op.text} color={op.color} fontSize={op.fontSize} displayMode={op.displayMode !== false} />
            </div>
          );
        })}
      </div>
    </div>
  );
};