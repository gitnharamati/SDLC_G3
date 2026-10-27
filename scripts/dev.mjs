import { spawn } from 'node:child_process';

// Run both services from one command, including on Windows.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['dev:api', 'dev:web'].map(script =>
  spawn(npm, ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' })
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
