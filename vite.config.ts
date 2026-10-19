import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cloudbase-rdb': {
        target: 'https://personspace-d7glmpjdpd81220f3.api.tcloudbasegateway.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cloudbase-rdb/, '/v1/rdb/rest'),
      },
      '/cloudbase-auth': {
        target: 'https://personspace-d7glmpjdpd81220f3.api.tcloudbasegateway.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cloudbase-auth/, ''),
      },
    },
  },
})
