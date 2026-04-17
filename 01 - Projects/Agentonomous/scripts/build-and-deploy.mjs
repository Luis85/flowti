import { execSync } from 'node:child_process';

execSync('vite build', {
	stdio: 'inherit',
	env: { ...process.env, AGENTONOMOUS_DEPLOY: '1' },
});
