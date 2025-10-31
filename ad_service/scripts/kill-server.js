#!/usr/bin/env node

/**
 * Kill server process running on port 8791
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = process.env.PORT || 8791;

async function killServer() {
  try {
    console.log(`🔍 Looking for processes on port ${PORT}...`);

    // For Windows
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${PORT}`);
        const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
        
        if (lines.length === 0) {
          console.log('✅ No server running on port ' + PORT);
          return;
        }

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          
          if (pid && !isNaN(pid)) {
            console.log(`🔪 Killing process ${pid}...`);
            await execAsync(`taskkill /F /PID ${pid}`);
          }
        }

        console.log('✅ Server stopped successfully');
      } catch (error) {
        if (error.code === 1) {
          console.log('✅ No server running on port ' + PORT);
        } else {
          throw error;
        }
      }
    } else {
      // For Unix-like systems (macOS, Linux)
      try {
        const { stdout } = await execAsync(`lsof -ti:${PORT}`);
        const pids = stdout.trim().split('\n').filter(pid => pid);

        if (pids.length === 0) {
          console.log('✅ No server running on port ' + PORT);
          return;
        }

        for (const pid of pids) {
          console.log(`🔪 Killing process ${pid}...`);
          await execAsync(`kill -9 ${pid}`);
        }

        console.log('✅ Server stopped successfully');
      } catch (error) {
        if (error.code === 1) {
          console.log('✅ No server running on port ' + PORT);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

killServer();
