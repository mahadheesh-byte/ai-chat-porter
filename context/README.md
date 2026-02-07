# Context condenser

`context.py` turns an exported chat JSON into a **short prompt** that keeps the important context so you can continue the conversation in another chat (or paste it into the extension).

## Usage

```bash
# From project folder
python context/context.py path/to/chat-export-xxx.json
```

Output is printed to stdout. To save to a file:

```bash
python context/context.py path/to/chat-export-xxx.json -o condensed.txt
```

Read from stdin:

```bash
python context/context.py - < export.json
```

## Options

- `-o FILE` — Write the condensed prompt to `FILE` instead of stdout.
- `--max-chars N` — Limit total length (default: 4000).

## What it does

The script builds a single prompt that includes:

1. **Topic / goal** — From the first user message.
2. **Key points** — Short bullets from the middle of the conversation (for long chats).
3. **Last exchange** — Your last message and the assistant’s last reply.
4. **Instruction** — “Please continue from where we left off.”

That keeps context high while staying short so it fits in the target model’s context window.

## No extra dependencies

Uses only the Python standard library (no `pip` install).
