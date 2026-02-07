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
    """Load messages from a file path or from stdin. Returns list of {role, content, attachments?}."""
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
        attachments = m.get("attachments")
        if isinstance(attachments, list) and attachments:
            attachments = [a for a in attachments if isinstance(a, dict)]
        else:
            attachments = None
        if content or attachments:
            msg = {"role": role, "content": content or "(attachment)"}
            if attachments:
                msg["attachments"] = attachments
            out.append(msg)
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


def _attachment_refs(msg):
    """Format attachment refs for a message (export may include attachments)."""
    if not msg or not isinstance(msg, dict):
        return ""
    atts = msg.get("attachments") or []
    if not atts:
        return ""
    refs = [a.get("url") or a.get("name") or "" for a in atts if isinstance(a, dict)]
    refs = [r for r in refs if r]
    if not refs:
        return ""
    return " [Attachments: " + ", ".join(refs) + "]"


def condense(messages, max_chars=4000):
    """
    Build a single condensed prompt string from a list of messages.
    Maximizes useful context while staying under roughly max_chars.
    Messages may include optional "attachments" (list of {type, url, name}).
    """
    if not messages:
        return "No conversation to condense."

    # Last exchange (full message dicts for attachment refs)
    last_user_msg = None
    last_assistant_msg = None
    for m in reversed(messages):
        if m.get("role") == "user" and last_user_msg is None:
            last_user_msg = m
        elif m.get("role") == "assistant" and last_assistant_msg is None:
            last_assistant_msg = m
        if last_user_msg and last_assistant_msg:
            break
    last_user = (last_user_msg or {}).get("content") or ""
    last_assistant = (last_assistant_msg or {}).get("content") or ""

    # First user message = topic/goal
    first_user = None
    for m in messages:
        if m.get("role") == "user":
            first_user = (m.get("content") or "").strip()
            break

    has_attachments = any(m.get("attachments") for m in messages)

    # Middle context
    middle = []
    n = len(messages)
    if n > 4:
        for i in range(1, max(1, n - 2)):
            middle.append((messages[i].get("content") or ""))

    parts = []
    parts.append("Context from a previous conversation (continue from here):\n")
    if first_user:
        parts.append(f"Topic / goal: {truncate(first_user, 300)}\n")
    if has_attachments:
        parts.append("(Conversation included images or file attachments.)\n")
    if middle:
        bullets = bullet_summary(middle, max_bullets=5, max_chars_per_bullet=100)
        if bullets:
            parts.append("Key points from the middle of the conversation:")
            for b in bullets:
                parts.append(f"  • {b}")
            parts.append("")
    if last_user or last_assistant:
        parts.append("Last exchange:")
        if last_user or (last_user_msg and (last_user_msg.get("attachments"))):
            parts.append(f"  Me: {truncate(last_user, 800)}{_attachment_refs(last_user_msg)}")
        if last_assistant or (last_assistant_msg and (last_assistant_msg.get("attachments"))):
            parts.append(f"  Assistant: {truncate(last_assistant, 800)}{_attachment_refs(last_assistant_msg)}")
        parts.append("")
    parts.append("---\nPlease continue from where we left off.")

    result = "\n".join(parts).strip()
    if len(result) <= max_chars:
        return result

    parts = [
        "Context from a previous conversation (continue from here):\n",
        f"Topic / goal: {truncate(first_user, 250)}\n" if first_user else "",
        "(Conversation included images or file attachments.)\n" if has_attachments else "",
        "Last exchange:",
        f"  Me: {truncate(last_user, 500)}{_attachment_refs(last_user_msg)}" if last_user or last_user_msg else "",
        f"  Assistant: {truncate(last_assistant, 500)}{_attachment_refs(last_assistant_msg)}" if last_assistant or last_assistant_msg else "",
        "\n---\nPlease continue from where we left off.",
    ]
    result = "\n".join(p for p in parts if p)
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
