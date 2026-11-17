# Authoring Particle Zoo tests

A grammar card may include `particleTests`, an array of explicitly authored tests.
The normal `{word}` markup, pinyin, English and distractors remain unchanged.
Raw sentences are never automatically converted into uniquely graded tests.
Imported duplicate grammar sentences retain existing data, including existing
particle tests, under the app's additive import policy.

Example test object:

```json
{
  "id": "possession-example",
  "focus": "的 · possession",
  "base": ["这", "是", "我", "书"],
  "prompt": "This is my book. Link 我 to the noun 书.",
  "choices": ["的", "得", "地"],
  "accepted": [{"choice": "的", "slot": 3}],
  "explanation": "的 links the possessor 我 to the noun 书: 我的书.",
  "pinyin": "Zhè shì wǒ de shū."
}
```

Slots are zero-based gaps: 0 is before the first token; `base.length` is after the
last. Here slot 3 means after 我, before 书. The inserted choice is not part of
`base`. The answer Chinese is reconstructed from base plus the accepted insertion.
Add every valid choice/slot pair for the specified context to `accepted`. If the
construction allows omission, include `∅` in choices and `{ "choice": "∅", "slot": -1 }` in accepted. The interface labels this “No particle” and does not require a gap. Include all natural answers consistent with the prompt. Split tests
requiring multiple simultaneous particles into separate exercises with enough
context. Avoid labeling different meanings as universally ungrammatical.

Include vocabulary cards for surrounding tokens to unlock Auto Study. Manual
Particle Zoo uses the same minimum-score and average-score prerequisites as Auto Study. Imported test
schedules use `grammar-id:particle:index`; preserve test array order once records
exist, or treat reordering as a content change requiring record reset.
