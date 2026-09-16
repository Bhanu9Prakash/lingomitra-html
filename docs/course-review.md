# Course coverage and review notes

The catalogue contains 34 courses, 884 numbered lessons and 4,778 practice items
extracted by the app's actual parser. The 27 additions contribute 675 lessons
and 3,150 items. Every new course has 25 substantive lessons, with four or six
production exercises per lesson, matching answer keys and explanations.

All 27 additions are **original AI-assisted drafts; fluent-speaker review is
pending**. References actually consulted and further-reading resources are
identified in each introduction. They support targeted editorial checks, not
certification of every original sentence. Course labels do not imply a complete
grammar, a proficiency level or coverage of every regional variety.

## Added Indian-language courses

Hindi and Kannada are retained, bringing scheduled Indian-language coverage to
22. The table describes the teaching variety and writing system of each addition.
Non-Latin courses include a separate Roman reading aid except the four explicitly
Roman-only foundations.

| Course | Teaching variety and script | Lessons | Practice items |
| --- | --- | ---: | ---: |
| [Assamese](../courses/assamese-lesson.md) | Contemporary standard Assamese; Assamese script | 25 | 150 |
| [Bengali](../courses/bengali-lesson.md) | Standard colloquial Bengali with West Bengal-leaning vocabulary; Bengali script | 25 | 150 |
| [Bodo](../courses/bodo-lesson.md) | Modern Bodo grammar foundation; Roman phonemic notation | 25 | 100 |
| [Dogri](../courses/dogri-lesson.md) | Small Jammu-area colloquial teaching set; Devanagari | 25 | 100 |
| [Gujarati](../courses/gujarati-lesson.md) | Contemporary standard Gujarati; Gujarati script | 25 | 100 |
| [Kashmiri](../courses/kashmiri-lesson.md) | Valley Kashmiri foundation; Roman transcription | 25 | 100 |
| [Konkani](../courses/konkani-lesson.md) | Goan, broadly Antruz-based written standard; Devanagari | 25 | 100 |
| [Maithili](../courses/maithili-lesson.md) | Central Mithila written forms in a respectful teaching register; Devanagari | 25 | 100 |
| [Malayalam](../courses/malayalam-lesson.md) | Broad contemporary standard; Malayalam script | 25 | 150 |
| [Manipuri / Meiteilon](../courses/manipuri-lesson.md) | CIIL-based grammar foundation; Roman learning transcription | 25 | 100 |
| [Marathi](../courses/marathi-lesson.md) | Contemporary standard Marathi; Devanagari | 25 | 100 |
| [Nepali](../courses/nepali-lesson.md) | Standard conversational Nepal Nepali; Devanagari | 25 | 100 |
| [Odia](../courses/odia-lesson.md) | Contemporary standard Odia; Odia script | 25 | 150 |
| [Punjabi](../courses/punjabi-lesson.md) | Eastern / Majhi-based standard; Gurmukhi | 25 | 100 |
| [Sanskrit](../courses/sanskrit-lesson.md) | Basic Classical Sanskrit; Devanagari and IAST | 25 | 150 |
| [Santali](../courses/santali-lesson.md) | Limited historical-source grammar foundation; Roman transcription | 25 | 150 |
| [Sindhi](../courses/sindhi-lesson.md) | Standard teaching register; Sindhi Perso-Arabic script | 25 | 100 |
| [Tamil](../courses/tamil-lesson.md) | Modern standard written Tamil, with labelled spoken contrasts; Tamil script | 25 | 150 |
| [Telugu](../courses/telugu-lesson.md) | Broad modern educated conversational Telugu; Telugu script | 25 | 150 |
| [Urdu](../courses/urdu-lesson.md) | Modern standard conversational Urdu; Perso-Arabic script | 25 | 100 |

## Added international courses

| Course | Teaching variety and script | Lessons | Practice items |
| --- | --- | ---: | ---: |
| [Persian](../courses/persian-lesson.md) | Contemporary Iranian Persian, standard written register; Persian alphabet | 25 | 100 |
| [Russian](../courses/russian-lesson.md) | Contemporary standard Russian; Cyrillic with teaching stress marks | 25 | 100 |
| [Italian](../courses/italian-lesson.md) | Contemporary standard Italian; Latin alphabet | 25 | 100 |
| [Arabic](../courses/arabic-lesson.md) | Modern Standard Arabic; Arabic script | 25 | 100 |
| [Portuguese](../courses/portuguese-lesson.md) | Brazilian Portuguese; standard Latin spelling | 25 | 150 |
| [Korean](../courses/korean-lesson.md) | Standard South Korean, mainly polite 해요 style; Hangul | 25 | 100 |
| [Turkish](../courses/turkish-lesson.md) | Contemporary standard Turkish; modern Turkish alphabet | 25 | 100 |

## Material format limitations

- **Bodo, Kashmiri, Manipuri and Santali:** native-script literacy and verified
  native-script answer keys are pending. The catalogue, reader, practice and
  conversation screens identify the Roman format. Device reading and dictation
  are disabled for these courses because native-language speech services cannot
  be assumed to interpret their teaching transcription correctly. Optional model
  prompts request the same notation; model compliance is not guaranteed.
- **Bodo and Manipuri:** complete tone instruction and reliable audio remain
  pending. Their introductions describe the limits of the notation used.
- **Santali:** the primary consulted grammar is Skrefsrud's 1873 public-domain
  work. Lessons preserve checked-consonant marks and source vowel distinctions.
  Contemporary usage, regional Roman conventions and Ol Chiki literacy need
  review. This is not advertised as a current conversational standard.
- **Dogri:** the small productive set draws on an NCERT sentence booklet and CIIL
  material. The Roman aid is not a complete tone transcription. Full tense
  paradigms and regional forms are outside the supplied foundation.
- **Sanskrit:** external sandhi is deliberately suspended in the word-by-word
  examples except where Lesson 22 teaches connected forms. The course is not
  Vedic recitation or a model of continuously sandhied classical prose.
- **Arabic:** the main reading convention omits selected short final case and
  mood vowels; Lesson 10 introduces case distinctions explicitly. The course
  teaches MSA and does not substitute an unnamed spoken dialect.
- **Russian:** stress accents are teaching aids and may be omitted in practice.
  An explicitly supplied stress mark must match the reference position.

## Retained courses

The existing seven Markdown files are unchanged by this expansion. Their
availability does not imply that a new linguistic review has taken place.
Some retained lessons do not contain extractable production exercises.

| Course | Numbered lessons | Extracted practice items |
| --- | ---: | ---: |
| [German](../courses/german-lesson.md) | 39 | 216 |
| [Spanish](../courses/spanish-lesson.md) | 25 | 312 |
| [French](../courses/french-lesson.md) | 25 | 145 |
| [Hindi](../courses/hindi-lesson.md) | 25 | 170 |
| [Chinese](../courses/chinese-lesson.md) | 30 | 214 |
| [Japanese](../courses/japanese-lesson.md) | 35 | 402 |
| [Kannada](../courses/kannada-lesson.md) | 30 | 169 |

## Validation and next review

Repository checks cover catalogue completeness, consecutive lesson numbering,
actual exercise extraction, acceptance of the supplied answer forms, Unicode
marks and Turkish casing. App checks execute Vue and the real local assets in
JSDOM to check all course routes, search, concealed answers, saved progress,
course-switch races, practice limits and conversation cancellation. Cache tests
exercise root and subdirectory installations, course migration, isolation and
rollback after a failed shell download. A separate DOM regression loads the new
page with the previous release's cached asset responses.

These checks establish structural and application behaviour. They do not verify
every translation, pronunciation, actual browser voice or natural conversational
choice. Visual browser inspection could not be completed in the authoring
environment because access to the local preview was blocked. The outdated home
install screenshot was removed from the manifest pending regeneration.

Fluent reviewers should start with the disclosed variety and notation, then
check original example/answer pairs, respectful address, inflection, regional
vocabulary and natural discourse. Correct the course file and preserve its
stable slug. Run the commands in [README](../README.md) after edits. Mark a
course reviewed only after recording who reviewed it, its scope and date.
