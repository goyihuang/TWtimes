import { defineConfig } from 'vite';
// base './' 讓網站可以部署在 GitHub Pages 子路徑（/TWtimes/）或任何網域
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      input: ['index.html', 'taichung-1935.html', 'yuanshan.html', 'tainan.html'],
    },
  },
});
