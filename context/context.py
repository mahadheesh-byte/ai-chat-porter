#!/usr/bin/env python3
"""
Condense an exported AI chat (JSON) into a short prompt that maximizes context
for continuing the conversation. Output is suitable for pasting into any AI chat.
No external APIs; uses only the standard library.
"""

import json
import sys
import argparse


def load_messages(source):
    """Load messages from a file path or from stdin. Returns list of {role, content}."""
    if source is None or source == "-":
        data = json.load(sys.stdin)
    else:
        with open(source, "r", encoding="utf-8") as f:
            data = json.load(f)
    if not isinstance(data, dict) or "messages" not in data:
        raise ValueError("Invalid export: expected JSON object with 'messages' array")
    messages = data["messages"]
    if not isinstance(messages, list):
        raise ValueError("Invalid export: 'messages' must be an array")
    out = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        role = (m.get("role") or "user").strip().lower()
        if role not in ("user", "assistant"):
            role = "user"
        content = (m.get("content") or "").strip()
        if content:
            out.append({"role": role, "content": content})
    return out


def truncate(text, max_len, suffix="..."):
    """Truncate text to max_len, adding suffix if truncated."""
    text = (text or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - len(suffix)].rstrip() + suffix


def bullet_summary(lines, max_bullets=5, max_chars_per_bullet=120):
    """Turn a list of text lines into a short bullet summary."""
    bullets = []
    for line in lines:
        line = (line or "").strip()
        if not line or len(line) < 10:
            continue
        bullets.append(truncate(line, max_chars_per_bullet))
        if len(bullets) >= max_bullets:
            break
    return bullets


def condense(messages, max_chars=4000):
    """
    Build a single condensed prompt string from a list of messages.
    Maximizes useful context while staying under roughly max_chars.
    """
    if not messages:
        return "No conversation to condense."

    # Last exchange (last user + last assistant) — most important for "continue"
    last_user = None
    last_assistant = None
    for m in reversed(messages):
        if m["role"] == "user" and last_user is None:
            last_user = m["content"]
        elif m["role"] == "assistant" and last_assistant is None:
            last_assistant = m["content"]
        if last_user is not None and last_assistant is not None:
            break

    # First user message = topic/goal
    first_user = None
    for m in messages:
        if m["role"] == "user":
            first_user = m["content"]
            break

    # Middle context: short bullets from middle messages (skip first and last)
    middle = []
    n = len(messages)
    if n > 4:
        start = 1
        end = max(1, n - 2)
        for i in range(start, end):
            middle.append(messages[i]["content"])

    parts = []

    # 1) Intro
    parts.append("Context from a previous conversation (continue from here):\n")

    # 2) Topic from first message
    if first_user:
        topic = truncate(first_user, 300)
        parts.append(f"Topic / goal: {topic}\n")

    # 3) Middle summary (if any)
    if middle:
        bullets = bullet_summary(middle, max_bullets=5, max_chars_per_bullet=100)
        if bullets:
            parts.append("Key points from the middle of the conversation:")
            for b in bullets:
                parts.append(f"  • {b}")
            parts.append("")

    # 4) Last exchange (full, but truncated if huge)
    if last_user or last_assistant:
        parts.append("Last exchange:")
        if last_user:
            parts.append(f"  Me: {truncate(last_user, 800)}")
        if last_assistant:
            parts.append(f"  Assistant: {truncate(last_assistant, 800)}")
        parts.append("")

    # 5) Instruction
    parts.append("---\nPlease continue from where we left off.")

    result = "\n".join(parts).strip()

    # Enforce max_chars on the whole thing (trim middle bullets first, then last exchange)
    if len(result) <= max_chars:
        return result

    # Rebuild under limit: keep intro, topic, last exchange, and instruction; trim middle
    parts = []
    parts.append("Context from a previous conversation (continue from here):\n")
    if first_user:
        parts.append(f"Topic / goal: {truncate(first_user, 250)}\n")
    parts.append("Last exchange:")
    if last_user:
        parts.append(f"  Me: {truncate(last_user, 500)}")
    if last_assistant:
        parts.append(f"  Assistant: {truncate(last_assistant, 500)}")
    parts.append("\n---\nPlease continue from where we left off.")
    result = "\n".join(parts)
    if len(result) > max_chars:
        result = result[: max_chars - 20].rstrip() + "\n\nPlease continue from here."
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Condense an AI chat export (JSON) into a short prompt for continuing the conversation."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="-",
        help="Path to exported chat JSON file, or '-' for stdin (default: stdin)",
    )
    parser.add_argument(
        "-o", "--output",
        metavar="FILE",
        help="Write condensed prompt to FILE instead of stdout",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=4000,
        metavar="N",
        help="Maximum length of the condensed prompt (default: 4000)",
    )
    args = parser.parse_args()

    try:
        messages = load_messages(args.input if args.input != "-" else None)
    except FileNotFoundError:
        print("Error: File not found.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not messages:
        print("Error: No messages found in the export.", file=sys.stderr)
        sys.exit(1)

    prompt = condense(messages, max_chars=args.max_chars)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(prompt)
    else:
        print(prompt)


if __name__ == "__main__":
    main()
