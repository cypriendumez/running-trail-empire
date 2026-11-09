"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* `closeButton` (09/11/2026) : sur téléphone, toucher une notification met son compte à
          rebours en pause et il ne repart jamais — sans croix, elle restait à l'écran (capture de
          Cyprien, « ça veut pas s'enlever »). */}
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          style: {
            borderRadius: "16px",
            border: "1px solid #E4E4E7",
            fontSize: "14px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
