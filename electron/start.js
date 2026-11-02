import { spawn } from 'child_process';
import net from 'net';

const checkPort = (port, host, callback) => {
  const socket = new net.Socket();
  socket.setTimeout(800);
  
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  
  socket.connect(port, host);
};

let viteProcess = null;
let electronProcess = null;

const cleanup = () => {
  console.log('\nShutting down dev servers...');
  if (viteProcess) {
    try { viteProcess.kill(); } catch (e) {}
  }
  if (electronProcess) {
    try { electronProcess.kill(); } catch (e) {}
  }
  process.exit(0);
};

// Handle exit signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

const startVite = () => {
  console.log('Starting Vite development server on port 3000...');
  viteProcess = spawn('npx', ['vite'], {
    shell: true,
    stdio: 'inherit',
  });
  
  viteProcess.on('close', (code) => {
    viteProcess = null;
    cleanup();
  });
};

const startElectron = () => {
  console.log('Launching Electron...');
  electronProcess = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  
  electronProcess.on('close', (code) => {
    electronProcess = null;
    cleanup();
  });
};

// Begin booting
startVite();

// Poll until port 3000 is open, then launch Electron
const interval = setInterval(() => {
  checkPort(3000, 'localhost', (ready) => {
    if (ready) {
      clearInterval(interval);
      console.log('Vite server detected! Hooking in Electron window...');
      startElectron();
    }
  });
}, 400);
