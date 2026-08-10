import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Um valor novo a cada build — usado pra detectar deploy novo no cliente
// (ver src/hooks/useVersaoApp.js). Não precisa ser semver, só precisa mudar.
const buildVersion = String(Date.now())

// Grava dist/version.json a cada build de produção. O cliente já rodando faz
// polling desse arquivo (sempre com cache: 'no-store') e compara com a
// versão embutida no próprio bundle (__APP_VERSION__, injetada via define
// abaixo) — se diferir, é porque um deploy novo aconteceu.
function versionStampPlugin() {
  return {
    name: 'version-stamp',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      mkdirSync(outDir, { recursive: true })
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify({ version: buildVersion }))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionStampPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
})
