import { execSync } from 'node:child_process';

execSync('vite build --config configs/vite.config.ts', {
	stdio: 'inherit',
	env: { ...process.env, AGENTONOMOUS_DEPLOY: '1' },
});
