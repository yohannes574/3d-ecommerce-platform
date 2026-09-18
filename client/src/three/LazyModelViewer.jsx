import { lazy, Suspense } from 'react';

/**
 * Code-split boundary for the 3D viewer: three.js + drei (~1 MB) only
 * downloads when a page actually renders a viewer. Everything else
 * (catalog, cart, checkout…) stays lean.
 */
const ModelViewer = lazy(() => import('./ModelViewer'));

export default function LazyModelViewer({ fallback, ...props }) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <div className={`viewer-shell relative overflow-hidden ${props.className || ''}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            </div>
          </div>
        )
      }
    >
      <ModelViewer {...props} />
    </Suspense>
  );
}
