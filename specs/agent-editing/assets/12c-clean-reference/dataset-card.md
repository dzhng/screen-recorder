---
dataset_info:
  config_name: clean
  features:
  - name: file
    dtype: string
  - name: audio
    dtype:
      audio:
        sampling_rate: 16000
  - name: text
    dtype: string
  - name: speaker_id
    dtype: int64
  - name: chapter_id
    dtype: int64
  - name: id
    dtype: string
  splits:
  - name: validation
    num_bytes: 9677021.0
    num_examples: 73
  download_size: 9192059
  dataset_size: 9677021.0
configs:
- config_name: clean
  data_files:
  - split: validation
    path: clean/validation-*
---
