import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { notify, getSupabaseErrorMessage } from '@/services/notifications';

// Configuración del cliente de React Query
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Solo notificar errores de queries si son críticos o inesperados
      // Evitar notificar 404s que a veces son esperados
      console.error("Query Error:", error);
      const msg = getSupabaseErrorMessage(error);
      notify.error(`Error de carga: ${msg}`);
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      // Si la mutación tiene un mensaje de éxito definido en meta, mostrarlo
      const successMessage = mutation.meta?.successMessage;
      if (successMessage) {
        notify.success(successMessage);
      } else if (mutation.meta?.showGenericSuccess) {
        notify.success("Operación realizada correctamente");
      }
    },
    onError: (error, variables, context, mutation) => {
      // Si la mutación tiene un mensaje de error específico en meta, usarlo
      // Si no, parsear el error de Supabase
      const errorMessage = mutation.meta?.errorMessage || getSupabaseErrorMessage(error);
      notify.error(errorMessage);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1, // Reintentar una vez antes de fallar
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
