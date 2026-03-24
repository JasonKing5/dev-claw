module.exports = {
  apps: [
    {
      name: "dev-claw",
      script: "dist/index.js",
      node_args: "--env-file=.env",
    },
  ],
};
