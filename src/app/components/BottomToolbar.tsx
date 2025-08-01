import React from "react";
import { SessionStatus } from "@/app/types";

// Simple SVG icons to replace heroicons
const ChevronLeftIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  isPTTActive: boolean;
  setIsPTTActive: (val: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (val: boolean) => void;
  codec: string;
  onCodecChange: (newCodec: string) => void;
  onFileUpload: (file: File) => void;
  onUrlUpload: (url: string) => void;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,
  isPTTActive,
  setIsPTTActive,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  codec,
  onCodecChange,
  onFileUpload,
  onUrlUpload,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = React.useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUrlUpload = () => {
    if (audioUrl.trim()) {
      onUrlUpload(audioUrl.trim());
      setAudioUrl("");
    }
  };

  const handleCodecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCodec = e.target.value;
    onCodecChange(newCodec);
  };

  function getConnectionButtonLabel() {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  }

  function getConnectionButtonClasses() {
    const baseClasses = "text-white text-base p-2 w-36 rounded-md h-full";
    const cursorClass = isConnecting ? "cursor-not-allowed" : "cursor-pointer";

    if (isConnected) {
      // Connected -> label "Disconnect" -> red
      return `bg-red-600 hover:bg-red-700 ${cursorClass} ${baseClasses}`;
    }
    // Disconnected or connecting -> label is either "Connect" or "Connecting" -> black
    return `bg-black hover:bg-gray-900 ${cursorClass} ${baseClasses}`;
  }

  return (
    <div className="p-4 flex flex-row items-center justify-center gap-x-8">
      <button
        onClick={onToggleConnection}
        className={getConnectionButtonClasses()}
        disabled={isConnecting}
      >
        {getConnectionButtonLabel()}
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="audio/*"
      />
      <button
        onClick={handleUploadClick}
        className={`bg-blue-600 hover:bg-blue-700 text-white text-base p-2 w-36 rounded-md h-full ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!isConnected}
      >
        Upload Audio
      </button>

      <div className="flex flex-row items-center gap-2">
        <input
          type="url"
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          placeholder="Enter audio URL..."
          className={`border border-gray-300 rounded-md px-2 py-1 text-base w-64 focus:outline-none ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isConnected}
        />
        <button
          onClick={handleUrlUpload}
          className={`bg-green-600 hover:bg-green-700 text-white text-base p-2 w-32 rounded-md h-full ${!isConnected || !audioUrl.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isConnected || !audioUrl.trim()}
        >
          Process URL
        </button>
      </div>

      <div className="flex flex-row items-center gap-2">
        <input
          id="push-to-talk"
          type="checkbox"
          checked={isPTTActive}
          onChange={(e) => setIsPTTActive(e.target.checked)}
          disabled={!isConnected}
          className="w-4 h-4"
        />
        <label
          htmlFor="push-to-talk"
          className="flex items-center cursor-pointer"
        >
          Push to talk
        </label>
        <button
          onMouseDown={handleTalkButtonDown}
          onMouseUp={handleTalkButtonUp}
          onTouchStart={handleTalkButtonDown}
          onTouchEnd={handleTalkButtonUp}
          disabled={!isPTTActive}
          className={
            (isPTTUserSpeaking ? "bg-gray-300" : "bg-gray-200") +
            " py-1 px-4 cursor-pointer rounded-md" +
            (!isPTTActive ? " bg-gray-100 text-gray-400" : "")
          }
        >
          Talk
        </button>
      </div>

      <div className="flex flex-row items-center gap-1">
        <input
          id="audio-playback"
          type="checkbox"
          checked={isAudioPlaybackEnabled}
          onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
          disabled={!isConnected}
          className="w-4 h-4"
        />
        <label
          htmlFor="audio-playback"
          className="flex items-center cursor-pointer"
        >
          Audio playback
        </label>
      </div>

      <div className="flex flex-row items-center gap-2">
        <button
          onClick={() => setIsEventsPaneExpanded(!isEventsPaneExpanded)}
          className="p-2 rounded-full hover:bg-gray-200"
          title={isEventsPaneExpanded ? "Collapse Details" : "Expand Details"}
        >
          {isEventsPaneExpanded ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
        <div className="text-sm font-medium">
          {isEventsPaneExpanded ? "Hide Agent View" : "Show Agent View"}
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <div>Codec:</div>
        {/*
          Codec selector – Lets you force the WebRTC track to use 8 kHz 
          PCMU/PCMA so you can preview how the agent will sound 
          (and how ASR/VAD will perform) when accessed via a 
          phone network.  Selecting a codec reloads the page with ?codec=...
          which our App-level logic picks up and applies via a WebRTC monkey
          patch (see codecPatch.ts).
        */}
        <select
          id="codec-select"
          value={codec}
          onChange={handleCodecChange}
          className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none cursor-pointer"
        >
          <option value="opus">Opus (48 kHz)</option>
          <option value="pcmu">PCMU (8 kHz)</option>
          <option value="pcma">PCMA (8 kHz)</option>
        </select>
      </div>
    </div>
  );
}


export default BottomToolbar;
