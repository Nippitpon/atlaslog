import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // Vercel exposes the SHA via env when git isn't callable
    const sha = process.env.VERCEL_GIT_COMMIT_SHA
    return sha ? sha.slice(0, 7) : 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitShortHash()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
})
