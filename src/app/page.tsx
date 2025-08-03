import React, { Suspense } from "react";
import { LanguageProvider } from "@/app/contexts/LanguageContext";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { DataCollectionProvider } from "@/app/contexts/DataCollectionContext";
import { SalesDataProvider } from "@/app/contexts/SalesDataContext";
import { ConsultationDataProvider } from "@/app/contexts/ConsultationDataContext";
import App from "@/app/App";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LanguageProvider>
        <DataCollectionProvider>
          <SalesDataProvider>
            <ConsultationDataProvider>
              <TranscriptProvider>
                <EventProvider>
                  <App />
                </EventProvider>
              </TranscriptProvider>
            </ConsultationDataProvider>
          </SalesDataProvider>
        </DataCollectionProvider>
      </LanguageProvider>
    </Suspense>
  );
}
