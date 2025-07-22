import { Hono } from "hono";
import { generateText, streamText, tool } from "ai";
import { streamText as honoStreamText } from "hono/streaming";
import { z } from "zod";
import { google } from "@ai-sdk/google";

const problemFinderTool = tool({
  description:
    "Find real problems about a topic that people are discussing on social platforms",
  parameters: z.object({
    topic: z.string(),
  }),
  execute: async ({ topic }) => {
    const allProblems = [];

    const subreddits = [
      "mildlyinfuriating",
      "firstworldproblems",
      "NoStupidQuestions",
      "explainlikeimfive",
      "LifeProTips",
      "YouShouldKnow",
      "DoesAnybodyElse",
    ];

    const topicSpecificSearches = [
      `site:reddit.com "${topic}" frustrating`,
      `site:reddit.com "${topic}" difficult`,
      `site:reddit.com "${topic}" annoying`,
      `site:reddit.com "wish there was" "${topic}"`,
      `site:reddit.com "why is ${topic} so"`,
      `site:reddit.com "${topic}" should be easier`,
    ];

    try {
      for (const sub of subreddits.slice(0, 3)) {
        try {
          let uri = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(
            `"${topic}" (frustrating OR annoying OR difficult OR "wish there was" OR "why is" OR "should be easier")`
          )}&limit=5&sort=top&t=year&restrict_sr=1`;

          console.log(`Searching ${sub}:`, uri);
          const response = await fetch(uri);
          const data = await response.json();

          if (data.data?.children) {
            const problems = data.data.children.slice(0, 3).map((post) => ({
              title: post.data.title,
              text:
                post.data.selftext?.substring(0, 300) + "..." ||
                "No description",
              upvotes: post.data.ups,
              comments: post.data.num_comments,
              url: `https://reddit.com${post.data.permalink}`,
              subreddit: sub,
            }));
            allProblems.push(...problems);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (subError) {
          console.log(`Failed to search ${sub}:`, subError);
        }
      }

      if (allProblems.length < 3) {
        try {
          let generalUri = `https://www.reddit.com/search.json?q=${encodeURIComponent(
            `"${topic}" (frustrating OR "wish there was" OR "why is" OR difficult OR annoying) -site:github.com -site:stackoverflow.com`
          )}&limit=8&sort=top&t=year`;

          console.log("General search:", generalUri);
          const response = await fetch(generalUri);
          const data = await response.json();

          if (data.data?.children) {
            const problems = data.data.children.slice(0, 5).map((post) => ({
              title: post.data.title,
              text:
                post.data.selftext?.substring(0, 300) + "..." ||
                "No description",
              upvotes: post.data.ups,
              comments: post.data.num_comments,
              url: `https://reddit.com${post.data.permalink}`,
              subreddit: post.data.subreddit,
            }));
            allProblems.push(...problems);
          }
        } catch (generalError) {
          console.log("General search failed:", generalError);
        }
      }

      const uniqueProblems = allProblems
        .filter(
          (problem, index, self) =>
            index === self.findIndex((p) => p.title === problem.title)
        )
        .sort((a, b) => b.upvotes + b.comments - (a.upvotes + a.comments))
        .slice(0, 6);

      return JSON.stringify({
        platform: "reddit",
        problems: uniqueProblems,
        searchStrategy: "multi-subreddit + frustration keywords",
      });
    } catch (error) {
      console.error("Problem finder failed:", error);
      return JSON.stringify({
        error: "Problem finding failed",
        details: error,
      });
    }
  },
});

const isIdeaGenuineFinder = tool({
  description:
    "Given an idea title and some text this tool evaluates if it's a genuine business problem relevant to the topic",
  parameters: z.object({
    title: z.string().describe("The title of the problem/post"),
    text: z.string().describe("The description or content of the problem"),
    topic: z.string().describe("The original topic to check relevance against"),
  }),
  execute: async ({ title, text, topic }) => {
    try {
      let result = await generateText({
        model: google("gemini-2.0-flash"),
        temperature: 0.3,
        prompt: `
You are an expert business idea evaluator.
Your job is to decide if the following problem/post is BOTH:
1. A genuine business problem or pain point (not spam, not irrelevant content), and
2. Clearly relevant to the topic: "${topic}"

Title: "${title}"
Description: "${text}"

Reply with only one word: "good" if it satisfies both conditions, otherwise reply with "bad".
        `,
      });
      const answer = result.text.trim().toLowerCase();
      const evaluation = answer.includes("good") ? "good" : "bad";
      return JSON.stringify({
        evaluation,
        title,
        text,
        topic,
        reasoning: `Evaluated as ${evaluation} for topic: ${topic}`,
      });
    } catch (error) {
      console.error("Idea evaluation failed:", error);
      return JSON.stringify({ error: "Idea evaluation failed" });
    }
  },
});

const appRoute = new Hono().get("/ideas/:topic", async (c) => {
  try {
    const topic = c.req.param("topic");
    const result = await streamText({
      model: google("gemini-2.5-pro"),
      tools: {
        findProblems: problemFinderTool,
        isProblemGenuine: isIdeaGenuineFinder,
      },
      maxSteps: 10,
      prompt: `
You are a helpful startup assistant. Your goal is to find REAL user frustrations and pain points, not showcase existing solutions.

Follow these steps exactly:

1. FIRST: Call the 'findProblems' tool with topic: "${topic}"
   - This will search for people complaining, asking questions, or expressing frustrations related to ${topic}

2. THEN: For EACH problem returned from step 1, call the 'isProblemGenuine' tool to verify it's a real pain point:
   - Extract the 'title' from each problem
   - Extract the 'text' from each problem  
   - Use the original topic "${topic}" as the 'topic' parameter
   - Look for problems where people are genuinely frustrated or asking "why can't I..." or "I wish there was..."

3. FINALLY: Generate 3 SaaS startup ideas based ONLY on the verified pain points marked as "good":
   - Quote the specific user frustration each idea addresses
   - Describe your SaaS solution that eliminates this pain point
   - Explain why current solutions are inadequate (based on the complaints)
   - Propose a monetization strategy
   - Estimate market size based on how many people seem to have this problem

Focus on PROBLEMS and FRUSTRATIONS, not existing solutions or success stories.
      `,
    });

    let reader = result.textStream.getReader();

    return honoStreamText(c, async (stream) => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        await stream.write(value)
      }
    });
    
  } catch (err) {
    console.log("Error:", err);
    return c.json({ error: "Failed to generate ideas" }, 500);
  }
});

export default appRoute;
