/**
 * edit.js
 *
 * Simple config editor for Messenger bot settings and replies.
 * You can change tokens, default messages, and command replies
 * without touching the main code (messengerWebhook.js).
 *
 * Run from terminal:
 *    node edit.js set VERIFY_TOKEN mytoken123
 *    node edit.js set PAGE_ACCESS_TOKEN EAA...
 *    node edit.js get VERIFY_TOKEN
 *    node edit.js list
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'bot-config.json');

// Default config if none exists
const defaultConfig = {
  VERIFY_TOKEN: 'replace_with_verify_token',
  PAGE_ACCESS_TOKEN: 'replace_with_page_access_token',
  DEFAULT_REPLY: 'Assalamu Alaikum 🌸 How can I help you?',
  COMMANDS: {
    github: 'Visit: https://github.com/',
    help: 'Available commands: github, help, status',
    status: 'Server is running ✅'
  }
};

// Ensure config file exists
if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
}

// Load config
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Helper to save
function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Command-line args
const [,, action, key, ...rest] = process.argv;
const value = rest.join(' ');

switch (action) {
  case 'set':
    if (!key || !value) {
      console.log('Usage: node edit.js set <KEY> <VALUE>');
      process.exit(1);
    }
    if (key.startsWith('COMMAND_')) {
      const cmd = key.split('_')[1].toLowerCase();
      config.COMMANDS[cmd] = value;
      console.log(`✅ Command reply updated: ${cmd} -> "${value}"`);
    } else {
      config[key] = value;
      console.log(`✅ Config updated: ${key} -> "${value}"`);
    }
    saveConfig();
    break;

  case 'get':
    if (!key) {
      console.log('Usage: node edit.js get <KEY>');
      process.exit(1);
    }
    if (key.startsWith('COMMAND_')) {
      const cmd = key.split('_')[1].toLowerCase();
      console.log(`COMMAND_${cmd.toUpperCase()}:`, config.COMMANDS[cmd]);
    } else {
      console.log(`${key}:`, config[key]);
    }
    break;

  case 'list':
    console.log('📘 Current configuration:');
    console.log(JSON.stringify(config, null, 2));
    break;

  case 'reset':
    config = defaultConfig;
    saveConfig();
    console.log('🔄 Config reset to default.');
    break;

  default:
    console.log('Usage:');
    console.log('  node edit.js list');
    console.log('  node edit.js get VERIFY_TOKEN');
    console.log('  node edit.js set VERIFY_TOKEN mytoken123');
    console.log('  node edit.js set COMMAND_help "This is new help text"');
    console.log('  node edit.js reset');
    break;
}
