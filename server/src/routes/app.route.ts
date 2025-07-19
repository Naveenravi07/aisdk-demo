import { Hono } from "hono";
import { generateText, streamText } from "ai";
import { xai } from "@ai-sdk/xai";

const appRoute = new Hono().get("/ideas", async (c) => {
  const { text } = await streamText({
    model: xai("grok-3-beta"),
    prompt: "Generate 5 creative business ideas for a new startup in the tech industry.", 
  });
  console.log("Generated ideas:", text);
  return c.json({ message: text });
});

export default appRoute;