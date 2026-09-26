# readquick

A reading app where a user uploads a document and reads it one word at a time, with each word appearing in turn at a fixed point at the centre of the screen, so the eyes never have to move along lines of text.

## Language

**Document**:
A file a user uploads to read: an article, book or PDF (formats: EPUB, MOBI, TXT, PDF).
_Avoid_: Book, file, source, material

**Words read**:
The count of every Word shown at the Focus point while playing. Words shown again after a Rewind count again; Words skipped with Forward do not.
_Avoid_: Progress, words seen

**Reading speed**:
The speed a user actually read at: Words read divided by time spent playing, leaving out paused time. It differs from Speed, which is only the setting.
_Avoid_: Average speed, WPM

**Streak**:
The number of consecutive days on which a user played for at least one minute, with days taken in the user's own time zone.
_Avoid_: Chain, daily goal

**Library**:
A user's own list of Documents, and the user's home screen after signing in. Each entry shows how far the user has read.
_Avoid_: Bookshelf, dashboard, collection

**Word**:
One unit shown at the Focus point: a run of text between spaces. In Vietnamese each syllable is its own Word ("sinh viên" is two Words).
_Avoid_: Token, syllable

**Sentence**:
A run of Words ending in terminal punctuation. Rewind and Forward move between Sentences.
_Avoid_: Line, phrase

**Chapter**:
A named section of a Document that the user can jump to.
_Avoid_: Section, part, TOC entry

**Focus point**:
The fixed position at the centre of the screen where each word appears.
_Avoid_: Centre, cursor

**Anchor letter**:
The one highlighted letter of each word. It always sits exactly on the Focus point, so the eyes never move between words.
_Avoid_: Pivot, ORP, highlight

**Pause on punctuation**:
A word ending in punctuation, and a very long word, stays on screen longer than the base Speed gives it.
_Avoid_: Delay, dwell

**Speed**:
The rate at which words appear at the focus point, in words per minute. The user can adjust it.
_Avoid_: Pace, WPM (as a term for the concept)

**Rewind**:
Moving back by one sentence, triggered by the left button.
_Avoid_: Back, undo

**Forward**:
Moving ahead by one sentence, triggered by the right button.
_Avoid_: Skip, next

**Reading position**:
The word in a Document where a user last stopped reading. It belongs to the user and follows them across devices.
_Avoid_: Bookmark, progress, cursor
