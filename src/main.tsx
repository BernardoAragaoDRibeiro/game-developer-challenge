import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { queryClient } from './api/queryClient';
import './index.css';

async function startMockApi(): Promise<void> {
    const { worker } = await import('./mocks/browser');
    await worker.start({
        onUnhandledRequest: 'bypass',
        quiet: true,
        serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
}

void startMockApi()
    .catch(() => undefined)
    .then(() => {
        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <QueryClientProvider client={queryClient}>
                    <App />
                </QueryClientProvider>
            </StrictMode>,
        );
    });