import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const workspaceRoot = process.cwd();
const repoRoot = path.join(workspaceRoot, "vendor", "godot-docs");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withClient(run) {
  return withClientEnv({}, run);
}

async function withClientEnv(extraEnv, run) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"],
    cwd: workspaceRoot,
    env: {
      ...process.env,
      GODOT_DOCS_REPO: repoRoot,
      ...extraEnv
    }
  });

  const client = new Client(
    {
      name: "godot-docs-test",
      version: "0.0.1"
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  try {
    await run(client);
  } finally {
    await client.close();
  }
}

function firstTextContent(result) {
  const entry = result.content?.find((item) => item.type === "text");
  return entry?.text ?? "";
}

test("listTools exposes all expected Godot MCP tools", async () => {
  await withClient(async (client) => {
    const result = await client.listTools();
    const toolNames = result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [
      "godot_docs_list_topics",
      "godot_docs_read",
      "godot_docs_search",
      "godot_docs_status"
    ]);
  });
});

test("status reports mirror path and stable URL", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({ name: "godot_docs_status", arguments: {} });
    const text = firstTextContent(result);

    assert.match(text, new RegExp(`Repo: ${escapeRegExp(repoRoot)}`));
    assert.match(text, /Dokumente: \d+/);
    assert.match(text, /Stable-URL: https:\/\/docs\.godotengine\.org\/en\/stable\//);
  });
});

test("topics enumerate major sections", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({ name: "godot_docs_list_topics", arguments: {} });
    const text = firstTextContent(result);

    assert.match(text, /root \(1\)/);
    assert.match(text, /getting_started \(\d+\)/);
    assert.match(text, /tutorials \(\d+\)/);
    assert.match(text, /classes \(\d+\)/);
    assert.match(text, /getting_started\/first_2d_game\/index\.rst/);
    assert.match(text, /classes\/class_node\.rst/);
  });
});

test("search finds class results with line numbers and online URLs", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Base class for all scene objects.",
        section: "classes",
        max_results: 5
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /classes\/class_node\.rst:\d+ \[classes\] Base class for all scene objects\./);
    assert.match(text, /https:\/\/docs\.godotengine\.org\/en\/stable\/classes\/class_node\.html/);
    assert.ok(result.structuredContent.hits.length > 0);
  });
});

test("search finds guide content in getting_started", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Your first 2D game",
        section: "getting_started",
        max_results: 5
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /getting_started\/first_2d_game\/index\.rst:/);
  });
});

test("search covers root, about, community, engine_details, tutorials and readme", async () => {
  await withClient(async (client) => {
    const rootResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Welcome to the official documentation of",
        section: "root",
        max_results: 3
      }
    });
    const aboutResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Frequently asked questions",
        section: "about",
        max_results: 3
      }
    });
    const communityResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Community channels",
        section: "community",
        max_results: 3
      }
    });
    const engineDetailsResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Class reference primer",
        section: "engine_details",
        max_results: 3
      }
    });
    const tutorialsResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Using TileMaps",
        section: "tutorials",
        max_results: 3
      }
    });
    const readmeResult = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Sphinx",
        section: "readme",
        max_results: 3
      }
    });

    assert.match(firstTextContent(rootResult), /index\.rst:/);
    assert.match(firstTextContent(aboutResult), /about\/faq\.rst:/);
    assert.match(firstTextContent(communityResult), /community\/channels\.rst:/);
    assert.match(firstTextContent(engineDetailsResult), /engine_details\/class_reference\/index\.rst:/);
    assert.match(firstTextContent(tutorialsResult), /tutorials\/2d\/using_tilemaps\.rst:/);
    assert.match(firstTextContent(readmeResult), /README\.md:/);
  });
});

test("search respects max_results truncation", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Node",
        section: "classes",
        max_results: 2
      }
    });

    assert.equal(result.structuredContent.hits.length, 2);
    assert.equal(firstTextContent(result).trim().split("\n").length, 2);
  });
});

test("search all can return mixed-section results", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Introduction",
        section: "all",
        max_results: 20
      }
    });

    const hitSections = new Set(result.structuredContent.hits.map((hit) => hit.section));
    assert.ok(hitSections.size >= 2);
  });
});

test("search with no matches returns a clear empty result", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "___THIS_SHOULD_NOT_EXIST___",
        section: "all",
        max_results: 3
      }
    });

    assert.match(firstTextContent(result), /Keine Treffer/);
    assert.equal(result.structuredContent.hits.length, 0);
  });
});

test("read by class name resolves to class reference", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "Node",
        start_line: 1,
        max_lines: 12
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: classes/);
    assert.match(text, /Pfad: classes\/class_node\.rst/);
    assert.match(text, /Titel: Node/);
  });
});

test("read resolves lowercase slug and human title targets", async () => {
  await withClient(async (client) => {
    const classResult = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "node",
        start_line: 1,
        max_lines: 8
      }
    });
    const titleResult = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "Your first 2D game",
        start_line: 1,
        max_lines: 8
      }
    });

    assert.match(firstTextContent(classResult), /Pfad: classes\/class_node\.rst/);
    assert.match(firstTextContent(titleResult), /Pfad: getting_started\/first_2d_game\/index\.rst/);
  });
});

test("read by explicit path works for getting started guide", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "getting_started/first_2d_game/index.rst",
        start_line: 1,
        max_lines: 10
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: getting_started/);
    assert.match(text, /Titel: Your first 2D game/);
    assert.match(text, /Online: https:\/\/docs\.godotengine\.org\/en\/stable\/getting_started\/first_2d_game\/index\.html/);
  });
});

test("read accepts backslash paths and section-specific pages", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "engine_details\\class_reference\\index.rst",
        start_line: 1,
        max_lines: 8
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Bereich: engine_details/);
    assert.match(text, /Pfad: engine_details\/class_reference\/index\.rst/);
  });
});

test("read supports root index and README", async () => {
  await withClient(async (client) => {
    const indexResult = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "index",
        start_line: 1,
        max_lines: 8
      }
    });
    const readmeResult = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "README.md",
        start_line: 1,
        max_lines: 8
      }
    });

    assert.match(firstTextContent(indexResult), /Bereich: root/);
    assert.match(firstTextContent(indexResult), /Online: https:\/\/docs\.godotengine\.org\/en\/stable\//);
    assert.match(firstTextContent(readmeResult), /Bereich: readme/);
    assert.match(firstTextContent(readmeResult), /Online: https:\/\/github\.com\/godotengine\/godot-docs/);
  });
});

test("read line windows are numbered and bounded correctly", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "Node",
        start_line: 10,
        max_lines: 3
      }
    });

    const text = firstTextContent(result);
    assert.match(text, /Zeilen: 10-12 von \d+/);
    assert.match(text, /\n10: /);
    assert.match(text, /\n11: /);
    assert.match(text, /\n12: /);
  });
});

test("read with large start_line clamps to file length", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_read",
      arguments: {
        target: "Node",
        start_line: 99999,
        max_lines: 5
      }
    });

    assert.doesNotMatch(firstTextContent(result), /Zeilen: 99999-/);
  });
});

test("unknown tool name returns method-not-found error", async () => {
  await withClient(async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_nope",
        arguments: {}
      }),
      /Method not found|Unbekanntes Tool/
    );
  });
});

test("invalid search params return invalid-params errors", async () => {
  await withClient(async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_search",
        arguments: {
          query: "",
          section: "classes"
        }
      }),
      /query darf nicht leer sein/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_search",
        arguments: {
          query: "Node",
          section: "bad"
        }
      }),
      /section muss einer von/
    );
  });
});

test("search structuredContent exposes stable hit shape", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "godot_docs_search",
      arguments: {
        query: "Node",
        section: "classes",
        max_results: 1
      }
    });

    const hit = result.structuredContent.hits[0];
    assert.equal(typeof hit.relativePath, "string");
    assert.equal(typeof hit.section, "string");
    assert.equal(typeof hit.line, "number");
    assert.equal(typeof hit.text, "string");
  });
});

test("invalid read params return invalid-params errors", async () => {
  await withClient(async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_read",
        arguments: {
          target: "does-not-exist"
        }
      }),
      /Kein Doku-Ziel gefunden/
    );

    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_read",
        arguments: {
          target: "Node",
          max_lines: 401
        }
      }),
      /max_lines muss zwischen 1 und 400 liegen/
    );
  });
});

test("single MCP process remains stable across many sequential calls", async () => {
  await withClient(async (client) => {
    const calls = [
      () => client.callTool({ name: "godot_docs_status", arguments: {} }),
      () => client.callTool({ name: "godot_docs_list_topics", arguments: {} }),
      () => client.callTool({ name: "godot_docs_search", arguments: { query: "Node", section: "classes", max_results: 3 } }),
      () => client.callTool({ name: "godot_docs_search", arguments: { query: "Your first 2D game", section: "getting_started", max_results: 3 } }),
      () => client.callTool({ name: "godot_docs_search", arguments: { query: "Using TileMaps", section: "tutorials", max_results: 3 } }),
      () => client.callTool({ name: "godot_docs_read", arguments: { target: "Node", start_line: 1, max_lines: 6 } }),
      () => client.callTool({ name: "godot_docs_read", arguments: { target: "README.md", start_line: 1, max_lines: 6 } })
    ];

    for (let round = 0; round < 5; round += 1) {
      for (const execute of calls) {
        const result = await execute();
        assert.ok(firstTextContent(result).length > 0);
      }
    }
  });
});

test("missing local repo path produces a clear internal error", async () => {
  await withClientEnv({ GODOT_DOCS_REPO: path.join(workspaceRoot, "vendor", "missing-repo") }, async (client) => {
    await assert.rejects(
      async () => client.callTool({
        name: "godot_docs_status",
        arguments: {}
      }),
      /Godot-Doku-Repo nicht gefunden/
    );
  });
});
