import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Model Configuration API
 * Allows UI to dynamically switch between VoiceAgent Mini and Full models
 */

const CONFIG_FILE = path.join(process.cwd(), 'data', 'model-config.json');

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Default configuration
const DEFAULT_CONFIG = {
  selectedModel: 'full', // 'full' or 'mini'
  models: {
    full: {
      name: 'VoiceAgent Full',
      model: 'gpt-4o-realtime-preview-2024-12-17',
      performance: 'Premium',
      costTier: 'High',
      bestFor: 'Complex queries'
    },
    mini: {
      name: 'VoiceAgent Mini',
      model: 'gpt-4o-mini-realtime-preview-2024-12-17',
      performance: 'Standard',
      costTier: 'Low',
      bestFor: 'High-volume calls'
    }
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'system'
};

// Read current configuration
function readConfig() {
  try {
    ensureDataDir();
    
    if (!fs.existsSync(CONFIG_FILE)) {
      // Create default config if doesn't exist
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading model config:', error);
    return DEFAULT_CONFIG;
  }
}

// Write configuration
function writeConfig(config: any) {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing model config:', error);
    return false;
  }
}

// GET: Retrieve current model configuration
export async function GET(req: NextRequest) {
  try {
    const config = readConfig();
    
    return NextResponse.json({
      success: true,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('GET /api/admin/model-config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve model configuration',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST: Update model selection
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedModel } = body;
    
    // Validate input
    if (!selectedModel || !['full', 'mini'].includes(selectedModel)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid model selection. Must be "full" or "mini".'
        },
        { status: 400 }
      );
    }
    
    // Read current config
    const config = readConfig();
    
    // Update selected model
    config.selectedModel = selectedModel;
    config.lastUpdated = new Date().toISOString();
    config.updatedBy = body.updatedBy || 'admin';
    
    // Write updated config
    const success = writeConfig(config);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save configuration'
        },
        { status: 500 }
      );
    }
    
    const selectedModelInfo = config.models[selectedModel];
    
    console.log(`✅ Model switched to: ${selectedModelInfo.name} (${selectedModelInfo.model})`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully switched to ${selectedModelInfo.name}`,
      config: config,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('POST /api/admin/model-config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update model configuration',
        message: error.message
      },
      { status: 500 }
    );
  }
}

