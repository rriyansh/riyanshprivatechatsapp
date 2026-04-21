import { createContext, useContext, ReactNode } from "react";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { CallOverlay } from "@/components/call/CallOverlay";

type Ctx = ReturnType<typeof useVoiceCall>;

const CallContext = createContext<Ctx | undefined>(undefined);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const value = useVoiceCall();
  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
      {/* Hidden audio sink for remote stream */}
      <audio ref={value.remoteAudioRef} autoPlay playsInline className="hidden" />
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
};
