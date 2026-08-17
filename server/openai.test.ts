import { describe, expect, it } from "vitest";

describe("OpenAI API Key", () => {
  it("should be able to generate embeddings with the provided API key", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");

    // Test with a simple embedding request
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: "Test embedding"
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data[0].embedding).toBeDefined();
    expect(data.data[0].embedding.length).toBe(3072); // text-embedding-3-large has 3072 dimensions
  }, 30000); // 30 second timeout for API call
});
