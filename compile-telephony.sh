#!/bin/bash
# Compile telephony service to JavaScript for ES module support

echo "🔨 Compiling telephony service to JavaScript..."

# Create output directory
mkdir -p dist/server/telephony

# Compile TypeScript to JavaScript with ES modules
npx tsc \
  src/server/telephony/index.ts \
  src/server/telephony/audio.ts \
  --outDir dist/server \
  --module esnext \
  --target es2020 \
  --moduleResolution node \
  --esModuleInterop \
  --allowSyntheticDefaultImports \
  --resolveJsonModule \
  --skipLibCheck \
  --declaration false

echo "✅ Compilation complete!"
echo "📁 Output: dist/server/telephony/"
echo ""
echo "To run on GCP VM:"
echo "  node --experimental-modules dist/server/telephony/index.js"

