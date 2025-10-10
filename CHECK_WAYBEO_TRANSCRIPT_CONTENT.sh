#!/bin/bash

# Run this on your GCP VM to check the Waybeo transcript content

CALL_ID="9tSEponTlSZHK9dBIZ_7z"
TRANSCRIPT_FILE="/opt/voiceagent/data/transcripts/call_${CALL_ID}_1759916215009_transcript.json"

echo "========================================================================"
echo "TRANSCRIPT FILE ANALYSIS FOR WAYBEO CALL"
echo "========================================================================"
echo ""

echo "1. FILE INFO:"
ls -lh "$TRANSCRIPT_FILE"
echo ""

echo "2. CONVERSATION ARRAY COUNT:"
jq '.conversation | length' "$TRANSCRIPT_FILE"
echo ""

echo "3. SIMPLE TRANSCRIPTS:"
jq '.simple_transcripts' "$TRANSCRIPT_FILE"
echo ""

echo "4. FIRST 3 CONVERSATION EXCHANGES:"
jq '.conversation[0:3]' "$TRANSCRIPT_FILE"
echo ""

echo "5. CURRENT SALES DATA:"
jq '.current_sales_data' "$TRANSCRIPT_FILE"
echo ""

echo "6. ANALYTICS:"
jq '.analytics' "$TRANSCRIPT_FILE"
echo ""

echo "7. SEARCH FOR 'SCORPIO' IN CONVERSATION:"
jq '.conversation[] | select(.text | test("scorpio"; "i")) | {speaker, text}' "$TRANSCRIPT_FILE" 2>/dev/null || echo "Not found in conversation"
echo ""

echo "8. SEARCH FOR EMAIL IN CONVERSATION:"
jq '.conversation[] | select(.text | test("gmail"; "i")) | {speaker, text}' "$TRANSCRIPT_FILE" 2>/dev/null || echo "Not found in conversation"
echo ""

echo "9. ALL USER MESSAGES:"
jq '.conversation[] | select(.speaker == "user") | .text' "$TRANSCRIPT_FILE"
echo ""

echo "10. CHECK QUEUE ENTRY:"
ls -lh /opt/voiceagent/data/processing/call_${CALL_ID}*.json 2>/dev/null || echo "No queue entry found"
echo ""

echo "11. CHECK RESULTS FILE:"
ls -lh /opt/voiceagent/data/results/call_${CALL_ID}*.json 2>/dev/null || echo "No results file yet"
if [ -f /opt/voiceagent/data/results/call_${CALL_ID}*.json ]; then
  echo "Results content:"
  jq '.extracted_data' /opt/voiceagent/data/results/call_${CALL_ID}*.json 2>/dev/null
fi
echo ""

echo "========================================================================"
echo "COMPARISON WITH OZONETEL CALL (Working)"
echo "========================================================================"
echo ""

OZONETEL_FILE="/opt/voiceagent/data/transcripts/call_18882175990404261_1759904148319_transcript.json"

echo "Ozonetel conversation count:"
jq '.conversation | length' "$OZONETEL_FILE"
echo ""

echo "Ozonetel simple transcripts:"
jq '.simple_transcripts' "$OZONETEL_FILE"
echo ""

echo "Ozonetel analytics:"
jq '.analytics' "$OZONETEL_FILE"

