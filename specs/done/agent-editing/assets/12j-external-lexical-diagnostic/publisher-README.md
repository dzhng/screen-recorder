---
license: apache-2.0
dataset_info:
  features:
  - name: audio
    dtype: audio
  - name: transcript_annotated
    dtype: string
  - name: transcript_a
    dtype: string
  - name: transcript_b
    dtype: string
  - name: transcript_c
    dtype: string
  splits:
  - name: train
    num_bytes: 1343263191.5
    num_examples: 4500
  - name: validation
    num_bytes: 75479207.0
    num_examples: 250
  - name: test
    num_bytes: 72139425.0
    num_examples: 250
  download_size: 1482840572
  dataset_size: 1490881823.5
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
  - split: validation
    path: data/validation-*
  - split: test
    path: data/test-*
---

# DisfluencySpeech Dataset

The DisfluencySpeech Dataset is a single-speaker studio-quality labeled English speech dataset with paralanguage. 
A single speaker recreates nearly 10 hours of expressive utterances from the Switchboard-1 Telephone Speech Corpus 
(Switchboard), simulating realistic informal conversations. To aid the development of a text-to-speech (TTS) model that is able to 
predictively synthesise paralanguage from text without such components, we provide three different transcripts at 
different levels of information removal (removal of non-speech events, removal of non-sentence elements, 
and removal of false starts).

Read the paper [here](https://arxiv.org/abs/2406.08820).

Benchmark TTS models for each transcript can be found here: [Transcript A](https://huggingface.co/amaai-lab/DisfluencySpeech_BenchmarkA), [Transcript B](https://huggingface.co/amaai-lab/DisfluencySpeech_BenchmarkB), and [Transcript C](https://huggingface.co/amaai-lab/DisfluencySpeech_BenchmarkC).

# Dataset Details

All audio files are provided as 22,050 hz _.wav_ files. In the _metadata.csv_ file, 4 different transcripts for each file are provided, 
each at differing levels of information removal:

- _transcript_annotated_ is a full transcript retaining all non-speech event and disfluency annotations;
- _transcript_a_ contains all textual content recorded, including non-sentence elements and restarts. Only non-speech events such as laughter and sighs are removed from transcript;
- _transcript_b_ is _transcript_a_ but with filled pauses, explicit editing terms, and discourse markers removed. Coordinating conjunctions and asides are left in, as they are non-sentence elements as well, they are often used to convey meaning; and
- _transcript_c_ is _transcript_b_ but with false starts removed. This is the most minimal transcript.

The training set contains 90% of the data, the validation set contains 5% of the data, and the test set contains 5% of the data.

# Citation

If you use this dataset, please cite the paper in which it is presented:

```
@misc{wang2024disfluencyspeechsinglespeakerconversational,
      title={DisfluencySpeech -- Single-Speaker Conversational Speech Dataset with Paralanguage}, 
      author={Kyra Wang and Dorien Herremans},
      year={2024},
      eprint={2406.08820},
      archivePrefix={arXiv},
      primaryClass={eess.AS},
      url={https://arxiv.org/abs/2406.08820}, 
}
```