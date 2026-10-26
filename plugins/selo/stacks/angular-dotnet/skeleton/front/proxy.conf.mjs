// `/api` goes to the API of this run's slot (API_URL, set by serve.mjs); the API serves its routes at its root.
export default {
  "/api": {
    target: process.env.API_URL,
    pathRewrite: { "^/api": "" },
  },
};
