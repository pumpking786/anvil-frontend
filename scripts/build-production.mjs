import { cpSync, existsSync, lstatSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadEnv } from 'vite';
import { validateRelease } from './check-production.mjs';
import { vercelOutputConfiguration } from './configure-security.mjs';

export function writeVercelOutput(root, env) {
  const output = path.join(root, '.vercel/output');
  // Remove stale deployment headers/assets before validating or copying a new release.
  rmSync(output, { recursive: true, force: true });
  validateRelease(env);
  if (!existsSync(path.join(root, 'dist/index.html')))
    throw Error('Build the frontend before preparing its Vercel output.');
  try {
    cpSync(path.join(root, 'dist'), path.join(output, 'static'), {
      recursive: true,
      filter(source) {
        if (lstatSync(source).isSymbolicLink() || /^\.env(?:\.|$)/.test(path.basename(source)))
          throw Error('Private environment files and symlinks cannot enter the deployment.');
        return true;
      },
    });
    writeFileSync(
      path.join(output, 'config.json'),
      JSON.stringify(vercelOutputConfiguration(env.VITE_API_URL), null, 2) + '\n',
    );
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const require = createRequire(import.meta.url);
  try {
    rmSync(path.join(root, '.vercel/output'), { recursive: true, force: true });
    
    // Load environment and filter out Vercel injected system metadata 
    // so dynamic variables like VITE_VERCEL_GIT_PREVIOUS_SHA don't trigger validation errors.
    const rawEnv = loadEnv('production', root);
    const env = {};
    for (const [key, val] of Object.entries(rawEnv)) {
      if (!key.startsWith('VITE_VERCEL_')) {
        env[key] = val;
      }
    }

    validateRelease(env);
    execFileSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', 'tsconfig.json'],
      {
        cwd: root,
        stdio: 'inherit',
      },
    );
    await build({ root, mode: 'production', configFile: path.join(root, 'vite.config.ts') });
    writeVercelOutput(root, env);
    console.log('Vercel output ready: enforced CSP uses the configured backend origin.');
  } catch (error) {
    console.error(error.message || 'The frontend release build failed.');
    process.exitCode = 1;
  }
}