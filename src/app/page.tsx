import React, { Suspense } from "react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import App from "./App";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LanguageProvider>
        <TranscriptProvider>
          <EventProvider>
            <App />
          </EventProvider>
        </TranscriptProvider>
      </LanguageProvider>
    </Suspense>
  );
}
