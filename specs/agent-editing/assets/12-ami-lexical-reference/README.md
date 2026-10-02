# AMI human-checked lexical references

Status: reference preparation only. The unchanged speech engine has not run on
this selection; no speech-quality or release gate closes here.

The [AMI publisher's manual annotation package](https://groups.inf.ed.ac.uk/ami/AMICorpusAnnotations/ami_public_manual_1.6.2.zip)
supplies human-checked words from four speakers in one meeting. The frozen
selection retains complete publisher segments, including ordinary neighbors,
fragments, repetitions and nonlexical nodes. Selection used annotation text
before any model output and deliberately enriched literal “uh”/“um” occurrences.
Zero-uh/um controls do not imply absence of other hesitation forms. Adjacent
identical words are occurrence facts, never instructions to remove them.

The [transcription procedure](https://groups.inf.ed.ac.uk/ami/corpus/transcription.shtml)
distinguishes human transcript review from automatic word/phone alignment.
Accordingly the selected lexical reference omits word times. Original automatic
word times and reviewed segment anchors remain separately preserved as locators;
they cannot establish independent acoustic edges or safe crop boundaries.
Audio completeness, channel overlap, model-training exclusion, auditions and warm
resource use remain unverified. Publisher “unseen” metadata is not model-training
exclusion. Use the existing speech evaluator if source-bound predictions are
later obtained; this packet introduces no scorer or alternate recipe.

[Verification and member pins](verification.json) bind the complete source ranges,
all selected word text/order/attributes, source archive and retained packet.
[evidence.tar.xz](evidence.tar.xz) preserves the original selected XML inputs,
full license, notices, publisher documentation, frozen extraction producer and
outputs. The full annotation ZIP stays in the recorded private cache; no audio or
large corpus copy enters Git. Original path fields in the producer manifest remain
unchanged; verification records the durable private copy.

Attribution: AMI Meeting Corpus, University of Edinburgh/AMI consortium, obtained
from the publisher; annotations are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The archive retains the full original license and notices. Derived selection
changes only XML entity decoding and separates timing fields from lexical words;
original inputs remain intact. The publisher URL/page labels the package v1.6.2,
while its embedded README says release1.7; both declarations are preserved.
