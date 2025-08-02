import React, { Suspense } from "react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { DataCollectionProvider } from "@/app/contexts/DataCollectionContext";
import { SalesDataProvider } from "@/app/contexts/SalesDataContext";
import App from "@/app/App";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LanguageProvider>
        <DataCollectionProvider>
          <SalesDataProvider>
            <TranscriptProvider>
              <EventProvider>
                <App />
              </EventProvider>
            </TranscriptProvider>
          </SalesDataProvider>
        </DataCollectionProvider>
      </LanguageProvider>
    </Suspense>
  );
}
