"""Plain-language explanations of a single audit finding.

A finding already says what is wrong and carries the DDL that would fix it.
What it does not say is which of three defensible fixes to take, or what
"ON DELETE RESTRICT" means to somebody who has never had to choose one. This
module asks a model for those few sentences, and for nothing else.

Two boundaries make that safe to offer.

The model never writes SQL here. Every statement on the Schema Audit page was
produced by rules.py, which reads the catalog and knows the real constraint
names; a model asked to improve on that would write DDL that looks right and
drops the wrong constraint. The prompt forbids it, and the reply is rendered
as prose beside the statements rather than in place of them.

And no row of data is sent. A structural problem is a fact about the catalog,
so reading the tables to describe it would add nothing but another thing for
the model to be wrong about.

The finding itself is the whole input, and it never comes from the browser -
see main.py, which re-runs the audit and matches the request against its own
report before anything reaches this module.
"""

import hashlib
import json

from llm import client

# Written against what the rules actually produce. The fourth rule is the one
# that matters most: R002 alone can offer three fixes, one of which silently
# deletes employees, and a reader who skims past that is worse off than one who
# was never given a summary at all.
EXPLAIN_PROMPT = """You explain one finding from a database schema audit to the person who has to decide what to do about it.

They can read SQL and know their own tables. They have never had to choose
between ON DELETE actions, reason about which index covers a lookup, or argue
about surrogate keys. Explain the idea, not the syntax.

Rules:
- Three to five sentences, in one or two short paragraphs. No heading, no
  bullet list, no sign-off.
- Plain prose, and no markdown of any kind: no asterisks around a label, no
  backticks, no hashes. The page renders your reply as text, so an asterisk
  arrives as an asterisk.
- Begin with what goes wrong in practice, in terms of the tables and columns
  named below. Do not restate the rule name and do not repeat the finding back.
- Then say which of the fixes to take and why. Name it by quoting its label
  word for word, without the "Fix:" in front of it and without anything from
  the lines beneath it. Never call it "the first fix" or "fix 1": the reader
  sees those labels on screen with no numbers beside them, so a number gives
  them nothing to look for. Where a fix says the choice depends on a business
  rule, say what the decision turns on rather than making it for them.
- Any fix that deletes data must be called out as such, naming what would be
  deleted.
- Never write SQL. Never name a table, column, constraint or index that does
  not appear below. The statements are already on screen next to your answer;
  you are explaining them, not replacing them.
- If the finding is marked heuristic, say plainly that it was inferred from
  naming and may be wrong.
"""


def finding_as_text(finding: dict) -> str:
    """One finding rendered as the block the model reads.

    Everything the reader can see is included, the statements among them, so
    the explanation can point at a specific fix rather than at a vague one.
    Each statement is collapsed onto a single line: the indentation is there
    for a human reading a code block and costs tokens for no gain here.
    """
    lines = [
        f"Rule: {finding['rule_id']} - {finding['rule_name']}",
        f"Severity: {finding['severity']}",
        f"About: {finding['target']}",
        f"Finding: {finding['message']}",
        f"Why the rule flags it: {finding['rationale']}",
    ]
    if finding.get("confidence") == "heuristic":
        lines.append(
            "Confidence: heuristic - inferred from naming, and possibly wrong."
        )

    remediations = finding.get("remediations") or ()
    if not remediations:
        lines.append("\nThe audit offers no fix for this finding.")
        return "\n".join(lines)

    # Listed without numbers on purpose. Numbered, the model refers back to
    # "fix 1", and the page shows labels with no numbers beside them - so the
    # reader is left counting cards to find the one being recommended.
    lines.append(f"\nFixes offered ({len(remediations)}):")
    for remediation in remediations:
        # The label stands alone on its line, with nothing appended to it.
        # Marking the recommended one in brackets after the label was tried and
        # was worse than useless: the model quoted the bracket as though it
        # were the name, and told the reader to take the fix labelled "[the
        # rule recommends this one]", which appears nowhere on the page.
        lines.append(f"\nFix: {remediation['label']}")
        lines.append(f"   Risk: {remediation.get('risk') or 'unknown'}")
        if remediation.get("recommended"):
            lines.append("   The audit recommends this fix.")
        if remediation.get("requires_decision"):
            lines.append(
                "   Choosing this depends on a business rule the audit cannot know."
            )
        if remediation.get("note"):
            lines.append(f"   Note: {remediation['note']}")
        if remediation.get("ddl"):
            lines.append(f"   Statement: {' '.join(remediation['ddl'].split())}")

    return "\n".join(lines)


def find_finding(findings, rule_id: str, target: str, message: str):
    """The finding a request is asking about, or None.

    Matched on all three fields rather than on the first two, because a rule
    can report the same object twice for different reasons - one index can be
    both a duplicate of a second and a leading subset of a third - and those
    two findings deserve different explanations.
    """
    for finding in findings:
        if (
            finding["rule_id"] == rule_id
            and finding["target"] == target
            and finding["message"] == message
        ):
            return finding
    return None


# Explanations already written, keyed by the content of the finding.
_cache: dict[str, str] = {}


def _cache_key(finding: dict) -> str:
    """Identifies a finding by what it says, not by where it sits in the report.

    Two things follow. The same finding explained twice costs one call, which
    is worth having on a free tier that answers in about ten seconds and
    refuses outright when it is busy. And an explanation cannot outlive what it
    describes: alter the schema and the message, the rationale or the list of
    fixes changes with it, so the key changes too and the stale sentence is
    never shown against a finding it no longer fits.
    """
    payload = json.dumps(finding, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def explain_finding(finding: dict, refresh: bool = False) -> str:
    """A few sentences about one finding. Raises client.LLMError on failure.

    Letting the error out is the opposite of what summarize_rows does in the
    ask pipeline, and deliberately so. There the rows are the answer and the
    sentence is a convenience laid over them, so a busy endpoint should cost
    the reader their summary and not their data. Here somebody pressed a button
    whose entire purpose was the sentence, and saying nothing would read as the
    button being broken rather than the model being unavailable.
    """
    key = _cache_key(finding)
    if not refresh and key in _cache:
        return _cache[key]

    explanation = client.chat(
        EXPLAIN_PROMPT,
        finding_as_text(finding),
        max_tokens=client.EXPLAIN_TOKENS,
    )
    _cache[key] = explanation
    return explanation
