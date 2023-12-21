// change to post request
import { Context } from "https://deno.land/x/hono@v3.11.8/context.ts";
import pushToGitHub,{redirectToGithubAuth} from "./controllers/upload.ts"
import { Hono } from 'https://deno.land/x/hono@v3.11.8/mod.ts'

const app = new Hono()

app.get('/', async (c:Context) => {
  return await redirectToGithubAuth(c)
})
app.get('/callback', async(c:Context)=> {
  try {
    return await pushToGitHub(c)
    
  } catch (error) {
    c.json({error})
  }
})


Deno.serve({ port: 5000 },app.fetch)
