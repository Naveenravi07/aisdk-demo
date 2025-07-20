import { Hono } from "hono";
import { generateText, tool} from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";

const problemFinderTool = tool({
  description:
    "Find real problems about a topic that people are discussing on social platforms",
  parameters: z.object({
    topic: z.string(),
  }),
  execute: async ({ topic }) => {
    try {
      let uri = `https://www.reddit.com/r/entrepreneur/search.json?q=${encodeURIComponent(
    `"${topic}" (problem OR issue OR frustration OR challenge)`
  )}&limit=10&sort=top&restrict_sr=1`
;
      console.log(uri)
      const response = await fetch(uri);
      const data = await response.json();

      const problems =
        data.data?.children?.slice(0, 5).map((post) => ({
          title: post.data.title,
          text: post.data.selftext?.substring(0, 200) + "...",
          upvotes: post.data.ups,
          comments: post.data.num_comments,
          url: `https://reddit.com${post.data.permalink}`,
        })) || [];

      return JSON.stringify({ platform: "reddit", problems });
    } catch (error) {
      return JSON.stringify({ error: "Reddit API failed" });
    }
  },
});

const appRoute = new Hono().get("/ideas/:topic", async (c) => {
  try {
    const topic = c.req.param("topic");
    const result = await generateText({
      model: google("gemini-2.5-pro"),
      tools: {
        findProblems: problemFinderTool,
      },
      prompt: `
              You're a startup idea generator. Your job is to discover real user problems from online platforms and propose practical SaaS ideas to solve them.
              Start by using the 'findProblem' tool to gather real frustrations related to the topic: "${topic}". 
              Then, based on the real posts you found, generate 3 SaaS product ideas. Each idea must:
              1. Quote or summarize the specific user frustration it solves.
              2. Describe how your SaaS solves it.
              3. Explain what makes your solution better than existing ones.
              4. Suggest a simple monetization model.
        `,
    });

    console.log(result);
    console.log(result.toolResults[0]?.result)

    return c.json({ text: result.text });
  } catch (err) {
    console.log(err);
  }
});

export default appRoute;
