const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
const octokit = require("../lib/getOctokit");

const owner = "Ovuoba-Chiagozie";
const repo = "Test_Repo";
const api_version = "2022-11-28";
const User_agent = "github_PR_bot";

const getBranchSha = async (branch) => {
  try {
    const workingBranch = branch || "main";
    const ref = await octokit.request(
      `GET /repos/${owner}/${repo}/git/ref/heads/${workingBranch}`,
      {
        owner: owner,
        repo: repo,
        ref: `heads/${workingBranch}`,
        headers: {
          //not required, but recommended
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    const SHA = ref.data.object.sha;
    return SHA;
  } catch (error) {
    return error;
  }
};

const createNewBranch = async (sha) => {
  const branchName = `feature-${new Date().getTime()}`;
  try {
    const data = await octokit.request(
      `POST /repos/${owner}/${repo}/git/refs`,
      {
        owner: owner,
        repo: repo,
        ref: `refs/heads/${branchName}`,
        sha: sha,
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return {
      data,
      branchName,
    };
  } catch (error) {
    return error;
  }
};

const getTreeSha = async (commit_sha) => {
  try {
    const response = await octokit.request(
      `GET /repos/${owner}/${repo}/git/commits/${commit_sha}`,
      {
        owner: owner,
        repo: repo,
        commit_sha: commit_sha,
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return response.data.tree.sha;
  } catch (error) {
    return error;
  }
};

const createBlobForEachFile = async (filePaths) => {
  try {
    const blobs = await Promise.all(
      filePaths.map(async (file) => {
        const content = fs.readFileSync(file, "utf8");
        const response = await octokit.request(
          `POST /repos/${owner}/${repo}/git/blobs`,
          {
            owner: owner,
            repo: repo,
            content: content,
            encoding: "utf-8",
            headers: {
              "X-GitHub-Api-Version": api_version,
              "User-Agent": User_agent,
            },
          }
        );
        return response.data;
      })
    );

    return blobs;
  } catch (error) {
    return error;
  }
};

const createNewTree = async (fileBlobs, BlobPaths, treeSha) => {
  try {
    const tree = fileBlobs.map(({ sha }, index) => {
      return {
        path: BlobPaths[index],
        mode: `100644`,
        type: `blob`,
        sha,
      };
    });

    const response = await octokit.request(
      `POST /repos/${owner}/${repo}/git/trees`,
      {
        owner: owner,
        repo: repo,
        base_tree: treeSha,
        tree: tree,
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return response.data;
  } catch (error) {
    return error;
  }
};

const createCommit = async (commitMessage, newTreeSha, parentCommitSha) => {
  try {
    const response = await octokit.request(
      `POST /repos/${owner}/${repo}/git/commits`,
      {
        owner: owner,
        repo: repo,
        message: commitMessage,
        parents: [parentCommitSha],
        tree: newTreeSha,
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return response.data;
  } catch (error) {
    return error;
  }
};

const pointBranchRefToCommit = async (branch, commitSha) => {
  try {
    const response = await octokit.request(
      `PATCH /repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        owner: owner,
        repo: repo,
        ref: `heads/${branch}`,
        sha: commitSha,
        force: true,
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return response;
  } catch (error) {
    return error;
  }
};

const createPullRequest = async (branch) => {
  try {
    const title = "Amazing new feature";
    const body = "Please pull these awesome changes in!";
    const response = await octokit.request(
      `POST /repos/${owner}/${repo}/pulls`,
      {
        owner: owner,
        repo: repo,
        title: title,
        body: body,
        head: branch,
        base: "main",
        headers: {
          "X-GitHub-Api-Version": api_version,
          "User-Agent": User_agent,
        },
      }
    );

    return response.data;
  } catch (error) {
    return error;
  }
};

const pushToGitHub = async (req, res) => {
  try {
    const mainBranchSha = await getBranchSha();
    const response = await createNewBranch(mainBranchSha);
    const branchSha = await getBranchSha(response.branchName);
    const treeSha = await getTreeSha(branchSha);
    const commitMessage = "commit message";
    //specify directory to copy files from
    const uploadDirectory = "./upload/*";
    const filePaths = await glob(uploadDirectory);
    const fileBlobs = await createBlobForEachFile(filePaths);
    const BlobPaths = filePaths.map((fullPath) =>
      path.relative("./upload", fullPath)
    );
    const newTree = await createNewTree(fileBlobs, BlobPaths, treeSha);
    const newCommit = await createCommit(commitMessage, newTree.sha, branchSha);
    await pointBranchRefToCommit(response.branchName, newCommit.sha);
    const resp = await createPullRequest(response.branchName);
    res
      .status(200)
      .json({ sucess: true, PRtitle: resp.title, PRbody: resp.body });
  } catch (error) {
    res.status(400).json({ sucess: false, error: error.message });
  }
};

module.exports = pushToGitHub;
