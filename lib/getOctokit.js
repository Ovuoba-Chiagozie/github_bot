const { Octokit } = require("octokit");

const octokit = new Octokit({
    auth: process.env.ACCESS_TOKEN,
  });

module.exports = octokit