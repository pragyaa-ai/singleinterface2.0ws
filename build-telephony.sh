#!/bin/bash
# Build script for telephony service - compiles TypeScript to JavaScript with ES modules

echo "🔨 Building telephony service (TypeScript → JavaScript with ES modules)..."
echo ""

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/server/telephony
mkdir -p dist/server/telephony

# Compile TypeScript to JavaScript
echo "📦 Compiling TypeScript..."
npx tsc --project tsconfig.telephony.json

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Build successful!"
  echo "📁 Output: dist/server/telephony/"
  echo ""
  echo "To run on GCP VM:"
  echo "  node dist/server/telephony/index.js"
  echo ""
  echo "Or update PM2 config:"
  echo "  script: 'dist/server/telephony/index.js'"
  echo "  interpreter: 'node'"
else
  echo ""
  echo "❌ Build failed!"
  exit 1
fi

