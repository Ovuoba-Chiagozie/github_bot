import axios from 'axios';
import { load } from 'load'
import {relative} from "path"
import { glob } from "glob"
import { Context } from "https://deno.land/x/hono@v3.11.8/mod.ts";

// change file name later to upload.js

export async function redirectToGithubAuth (c:Context):Promise<Response>{
  const env = await load()
  const CLIENT_ID = env["CLIENT_ID"]
 return c.redirect(
    `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=http://localhost:5000/callback&scope=user%20repo`
  );
  };

const getUser = async (access_token: string):Promise<string> => {
    try {
  
      // example with octokit instance    
      // const octokit = new Octokit({
      //   auth: `Bearer ${access_token}`,
      // })
      // const response = await octokit.request('GET /user', {
      //   headers: {
      //     'X-GitHub-Api-Version': '2022-11-28'
      //   }
      // })
      // return response
      const { data } = await axios({
        method: "GET",
        url: "https://api.github.com/user",
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
      });
      return data.login;
    } catch (error) {
      return error;
    }
  };

  const getUserAccessToken = async (c:Context):Promise<string> => {
  try {
      const env = await load()
    const {data} = await axios.post(
      "https://github.com/login/oauth/access_token",
      null,
      {
        params: {
          client_id: env["CLIENT_ID"],
          client_secret: env["CLIENT_SECRET"],
          code: c.req.query('code'),
        },
        headers: {
          Accept: "application/json",
        },
      }
    );
    const responseParams = data;
    const access_token = responseParams.access_token;
    return access_token;

  } catch (error) {
    return error;
  }
};

const getDefaultBranch = async (owner:string, access_token:string,repo:string):Promise<string> => {
    try {
      const {data} = await axios({
        method: "GET",
        url: `https://api.github.com/repos/${owner}/${repo}`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        params: {
          owner: owner,
          repo: repo,
        },
      });
      
      return data.default_branch;
    } catch (error) {
      return error;
    }
  };

  const getBranchSha = async (workingBranch:string, owner:string, access_token:string,repo:string):Promise<string> => {
    try {
      const {data}  = await axios({
        method: "GET",
        url: `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${workingBranch}`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        params: {
          owner: owner,
          repo: repo,
          ref: `heads/${workingBranch}`,
        },
      });
  
      const SHA = data.object.sha;
      return SHA;
    } catch (error) {
      return error;
    }
  };
  
  const checlIfRepoExists = async (owner:string, access_token:string) => {
    try {
      const repoName = `REPO-${new Date().getTime()}`;
      const { data } = await axios({
        method: "GET",
        url: `https://api.github.com/users/${owner}/repos`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        params: {
          username: owner,
        },
      });
  
      const ifexists = data.find((repo:{name:string}) => {
        return repo.name === repoName;
      });
      return {
        ifexists,
        repoName,
      };
    } catch (error) {
      return error;
    }
  };
  
  const createNewRepo = async (owner:string,access_token:string) => {
    try {
      const ifExistsResponse = await checlIfRepoExists(owner,access_token)
      if(!ifExistsResponse.ifexists) {
        const {data}= await axios({
          method: "POST",
          url: `https://api.github.com/user/repos`,
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: "application/vnd.github+json",
          },
          data: {
            name: ifExistsResponse.repoName,
            description: "This is your test repo!",
            homepage: "https://github.com",
            private: false,
            is_template: true,
            auto_init: true
          },
        });
        return data.name
      }else {
        // do logic to return meesage that repo already exists to the page the user is in as an alert message or so
      }
    } catch (error) {
      return error
    }
  };
  
  const createNewBranch = async (sha:string, owner:string, access_token:string,repo:string):Promise<string> => {
    const branchName = `feature-${new Date().getTime()}`;
    try {
       await axios({
        method: "POST",
        url: `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          owner: owner,
          repo: repo,
          ref: `refs/heads/${branchName}`,
          sha: sha,
        },
      });
    
      return branchName
      
    } catch (error) {
      return error;
    }
  };
  
  const getTreeSha = async (commit_sha:string, owner:string, access_token:string,repo:string) => {
    try {
      const { data } = await axios({
        method: "GET",
        url: `https://api.github.com/repos/${owner}/${repo}/git/commits/${commit_sha}`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        params: {
          owner: owner,
          repo: repo,
          commit_sha: commit_sha,
        },
      });
     
      return data.tree.sha;
    } catch (error) {
      return error;
    }
  };
  
  const createBlobForEachFile = async (filePaths:string[], owner:string, access_token:string,repo:string):Promise<{sha:string}[]> => {
    try {
      const blobs = await Promise.all(
        filePaths.map(async (file) => {
            const content = Deno.readTextFileSync(file);;
          const { data } = await axios({
            method: "POST",
            url: `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
            headers: {
              Authorization: `Bearer ${access_token}`,
              Accept: "application/vnd.github+json",
            },
            data: {
              owner: owner,
              repo: repo,
              content: content,
              encoding: "utf-8",
            },
          });
          
          return data;
        })
      );
  
      return blobs;
    } catch (error) {
      return error;
    }
  };
  
  const createNewTree = async (
    fileBlobs:{sha: string}[],
    BlobPaths:string[],
    treeSha:string,
    owner:string,
    access_token:string,
    repo:string
  ):Promise<string> => {
    try {
      const tree = fileBlobs.map(({ sha }, index) => {
        return {
          path: BlobPaths[index],
          mode: `100644`,
          type: `blob`,
          sha,
        };
      });
  
      const { data } = await axios({
        method: "POST",
        url: `https://api.github.com/repos/${owner}/${repo}/git/trees`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          owner: owner,
          repo: repo,
          base_tree: treeSha,
          tree: tree,
        },
      });
  
      return data.sha;
    } catch (error) {
      return error;
    }
  };
  
  const createCommit = async (
    commitMessage:string,
    newTreeSha:string,
    parentCommitSha:string,
    owner:string,
    access_token:string,
    repo:string
  ):Promise<string> => {
    try {
      const { data } = await axios({
        method: "POST",
        url: `https://api.github.com/repos/${owner}/${repo}/git/commits`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          owner: owner,
          repo: repo,
          message: commitMessage,
          parents: [parentCommitSha],
          tree: newTreeSha,
        },
      });
      
  
      return data.sha;
    } catch (error) {
      return error;
    }
  };
  
  const pointBranchRefToCommit = async (
    branch:string,
    commitSha:string,
    owner:string,
    access_token:string,
    repo:string
  ):Promise<void> => {
    try {
       await axios({
        method: "PATCH",
        url: `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          owner: owner,
          repo: repo,
          ref: `heads/${branch}`,
          sha: commitSha,
          force: true,
        },
      });
      return
    } catch (error) {
      return error;
    }
  };
  
  const createPullRequest = async (
    branch:string,
    owner:string,
    workingBranch:string,
    access_token:string,
    repo:string
  ) => {
    try {
      const title = "Amazing new feature";
      const body = "Please pull these awesome changes in!";
      const { data } = await axios({
        method: "POST",
        url: `https://api.github.com/repos/${owner}/${repo}/pulls`,
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          owner: owner,
          repo: repo,
          title: title,
          body: body,
          head: branch,
          base: workingBranch,
        },
      });
  
      return data;
    } catch (error) {
      return error;
    }
  };
  

export default async function pushToGitHub (c: Context) {
    try {
        const access_token = await getUserAccessToken(c);
        const owner = await getUser(access_token);
        const repo = await createNewRepo(owner,access_token)
        const workingBranch = await getDefaultBranch(owner, access_token,repo);
        const mainBranchSha = await getBranchSha(
          workingBranch,
          owner,
          access_token,
          repo
        );
        const branchName = await createNewBranch(mainBranchSha, owner, access_token,repo);
        const branchSha = await getBranchSha(
          branchName,
          owner,
          access_token,
          repo
        );
        const treeSha = await getTreeSha(branchSha, owner, access_token,repo);
        const commitMessage = "commit message";
        //specify directory to copy files from
        const uploadDirectory = "./upload/*";
        const filePaths = await glob(uploadDirectory);
        const fileBlobs = await createBlobForEachFile(
          filePaths,
          owner,
          access_token,
          repo
        );
        const BlobPaths = filePaths.map((fullPath:string) =>
          relative("./upload", fullPath)
        );
        const newTreeSha = await createNewTree(
          fileBlobs,
          BlobPaths,
          treeSha,
          owner,
          access_token,
          repo
        );
        const newCommitSha = await createCommit(
          commitMessage,
          newTreeSha,
          branchSha,
          owner,
          access_token,
          repo
        );
        await pointBranchRefToCommit(
          branchName,
          newCommitSha,
          owner,
          access_token,
          repo
        );
        const resp = await createPullRequest(
          branchName,
          owner,
          workingBranch,
          access_token,
          repo
        );
        return c.redirect(resp.html_url);
        
    } catch (error) {
        return error
    }
}

