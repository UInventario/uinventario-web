const target = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
