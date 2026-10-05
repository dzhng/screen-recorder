# STARSS23 Dataset

[Audio Research Group / Tampere University](https://webpages.tuni.fi/arg/)
[Creative AI Lab/ SONY R&D Center](https://www.sony.com/en/SonyInfo/research/research-areas/audio-acoustics/)

AUTHORS

**Tampere University**
- Archontis Politis ([contact](mailto:archontis.politis@tuni.fi), [profile](https://scholar.google.fi/citations?user=DuCqB3sAAAAJ&hl=en))
- Parthasaarathy Sudarsanam([contact](mailto:parthasaarathy.ariyakulamsudarsanam@tuni.fi), [profile](https://scholar.google.com/citations?user=yxZ1qAIAAAAJ&hl=en))
- Sharath Adavanne ([contact](mailto:sharath.adavanne@tuni.fi), [profile](https://www.aane.in))
- Daniel Alexander Krause ([contact](mailto:daniel.krause@tuni.fi), [profile](https://scholar.google.com/citations?user=pSLng-8AAAAJ&hl=en))
- Tuomas Virtanen ([contact](mailto:tuomas.virtanen@tuni.fi), [profile](https://homepages.tuni.fi/tuomas.virtanen/))
- Aapo Hakala

**SONY**
- Yuki Mitsufuji ([contact](mailto:yuhki.mitsufuji@sony.com), [profile](https://scholar.google.com/citations?user=GMytI10AAAAJ))
- Kazuki Shimada ([contact](mailto:kazuki.shimada@sony.com), [profile](https://scholar.google.com/citations?user=-t9IslAAAAAJ&hl=en))
- Naoya Takahashi ([profile](https://scholar.google.com/citations?user=JbtYJMoAAAAJ))
- Yuichiro Koyama
- Shusuke Takahashi 
- Kengo Uchida

# Description

The **Sony-TAu Realistic Spatial Soundscapes 2023 (STARSS23)** dataset contains multichannel recordings of sound scenes in various rooms and environments, together with temporal and spatial annotations of prominent events belonging to a set of target classes. The dataset is collected in two different countries, in Tampere, Finland by the Audio Researh Group (ARG) of **Tampere University (TAU)**, and in Tokyo, Japan by **SONY**, using a similar setup and annotation procedure. The dataset is delivered in two 4-channel spatial recording formats, a microphone array one (**MIC**), and first-order Ambisonics one (**FOA**). These recordings serve as the development dataset for the [DCASE 2023 Sound Event Localization and Detection Task](https://dcase.community/challenge2023/task-sound-event-localization-and-detection) of the [DCASE 2023 Challenge](https://dcase.community/challenge2023/).

The STARSS23 dataset is a continuation of the [STARSS22 dataset](zenodo.org/record/6600531). It extends the previous version with the following:

- An **additional 2hrs 30mins** of recordings in the development set, from 5 new rooms distributed in 47 new recording clips.
- An **additional 1hr 40mins** of recordings added in the evaluation set of the dataset.
- **360° videos** spatially and temporally aligned to the audio recordings of the dataset (apart from 12 audio-only clips).
- **Distance labels** (in cm) for the spatially annotated sound events, apart from only the previous azimuth and elevation labels.

Contrary to the three previous datasets of synthetic spatial sound scenes of TAU Spatial Sound Events 2019 ([development](10.5281/zenodo.2599196)/[evaluation](10.5281/zenodo.3377088)), [TAU-NIGENS Spatial Sound Events 2020](https://doi.org/10.5281/zenodo.4064792), and [TAU-NIGENS Spatial Sound Events 2021](10.5281/zenodo.5476980
) associated with the previous iterations of the DCASE Challenge, the STARSS22 dataset contains recordings of real sound scenes and hence it avoids some of the pitfalls of synthetic generation of scenes. Some such key properties are:

- annotations are based on a combination of human annotators for sound event activity and optical tracking for spatial positions
- the annotated target event classes are determined by the composition of the real scenes 
- the density, polyphony, occurences and co-occurences of events and sound classes is not random, and it follows actions and interactions of participants in the real scenes  

The first round of recordings was collected between September 2021 and January 2022. A second round of recordings was collected between November 2022 and February 2023.

Collection of data from the TAU side has received funding from Google.

# Aim

The STARSS23 datasets is suitable for training and evaluation of machine-listening models for sound event detection (SED), general sound source localization with diverse sounds or signal-of-interest localization, and joint sound-event-localization-and-detection (SELD). Additionally, the dataset can be used for evaluation of signal processing methods that do not necessarily rely on training, such as acoustic source localization methods and multiple-source acoustic tracking. The dataset allows evaluation of the performance and robustness of the aforementioned applications for diverse types of sounds, and under diverse acoustic conditions.

The dataset additionally allows evaluation of audiovisual processing methods with a spatial dimension, such as audiovisual source localization or audiovisual object recognition.

# Recording procedure

The sound scene recordings were captured with a high-channel-count spherical microphone array ([Eigenmike em32 by mh Acoustics](https://mhacoustics.com/products)), simultaneously with a 360° video recording spatially aligned with the spherical array recording ([Ricoh Theta V](https://theta360.com/en/about/theta/v.html)). Additionally, the main sound sources of interest were equipped with tracking markers, which are tracked throughout the recording with an [Optitrack Flex 13](https://optitrack.com/cameras/flex-13/) system arranged around each scene. All scenes were based on human actors performing some actions, interacting between them and with the objects in the scene, and were by design dynamic. Since the actors were producing most of the sounds in the scene (but not all), they were additionally equipped with [DPA Wireless Go II](https://rode.com/microphones/wireless/wirelessgoii) microphones, providing close-miked recordings of the main events. Recording would start and stop according to a scene being acted, usually lasting between 1~5mins. Recording would start in all microphones and tracking devices before the beginning of the scene, and would stop right after. A clapper sound would initiate the acting and it would serve as a reference signal for synchronization between the em32 recording, the Ricoh Theta V video, the DPA wireless microphone recordings, and the Optitrack tracker data. Synchronized clips of all of them would be cropped and stored in the end of each recording session.

# Annotation procedure

By combining information from the wireless microphones, the optical tracking data, and the 360° videos, spatiotemporal annotations were extracted semi-automatically, and validated manually. More specifically, the actors were tracked all through each recording session wearing headbands with markers, and the spatial positions of other human-related sources, such as mouth, hands, or footsteps were geometrically extrapolated from those head coordinates. Additional trackers were mounted on other sources of interest (e.g. vacuum cleaner, guitar, water tap, cupboard, door handle, a.o.).  Each actor had a wireless microphone mounted on their lapel, providing a clear recording of all sound events produced by that actor, and/or any independent sources closer to that actor than the rest. The temporal annotation was based primarily on those close-miked recordings. The annotators would annotate the sound event activity and label their class during the recording by listening those close-miked signals. Events that were not audible in the overall scene recording of the em32 were not annotated, even if they were audible in the lapel recordings. In ambiguous cases, the annotators could rely on the 360° video to associate an event with a certain actor or source. The final sound event temporal annotations were associated with the tracking data through the class of each sound event and the actor that produced them. All tracked Cartesian coordinates delivered by the tracker were converted to directions-of-arrival (DOAs) with respect to the coordinates of the Eigenmike. Finally, the final class, temporal, and spatial annotations were combined and converted to the challenge format. Validation of the annotations was done by observing videos of the activities of each class visualized as markers positioned at their respective DOAs on the 360° video plane, overlapped with the 360° from the Ricoh Theta V.

# Recording formats

The array response of the two recording formats can be considered known. The following theoretical spatial responses (steering vectors) modeling the two formats describe the directional response of each channel to a source incident from direction-of-arrival (DOA) given by azimuth angle $\phi$ and elevation angle $\theta$.

**For the first-order ambisonics (FOA):**

\begin{eqnarray}
H_1(\phi, \theta, f) &=& 1 \\
H_2(\phi, \theta, f) &=& \sin(\phi) * \cos(\theta) \\
H_3(\phi, \theta, f) &=& \sin(\theta) \\
H_4(\phi, \theta, f) &=& \cos(\phi) * \cos(\theta)
\end{eqnarray}
The (FOA) format is obtained by converting the 32-channel microphone array signals by means of encoding filters based on anechoic measurements of the Eigenmike array response. Note that in the formulas above the encoding format is assumed frequency-independent, something that holds true up to around 9kHz with the specific microphone array, while the actual encoded responses start to deviate gradually at higher frequencies from the ideal ones provided above. 

**For the tetrahedral microphone array (MIC):**

The four microphone have the following positions, in spherical coordinates $(\phi, \theta, r)$:

\begin{eqnarray} 
M1: &\quad(&45^\circ, &&35^\circ, &4.2\mathrm{cm})\nonumber\\
M2: &\quad(&-45^\circ, &-&35^\circ, &4.2\mathrm{cm})\nonumber\\
M3: &\quad(&135^\circ, &-&35^\circ, &4.2\mathrm{cm})\nonumber\\
M4: &\quad(&-135^\circ, &&35^\circ, &4.2\mathrm{cm})\nonumber
\end{eqnarray}

Since the microphones are mounted on an acoustically-hard spherical baffle, an analytical expression for the directional array response is given by the expansion:
\begin{equation}
H_m(\phi_m, \theta_m, \phi, \theta, \omega) = \frac{1}{(\omega R/c)^2}\sum_{n=0}^{30} \frac{i^{n-1}}{h_n'^{(2)}(\omega R/c)}(2n+1)P_n(\cos(\gamma_m))
\end{equation}

where $m$ is the channel number, $(\phi_m, \theta_m)$ are the specific microphone's azimuth and elevation position, $\omega = 2\pi f$ is the angular frequency, $R = 0.042$m is the array radius, $c = 343$m/s is the speed of sound, $\cos(\gamma_m)$ is the cosine angle between the microphone and the DOA, and $P_n$ is the unnormalized Legendre polynomial of degree $n$, and $h_n'^{(2)}$ is the derivative with respect to the argument of a spherical Hankel function of the second kind. The expansion is limited to 30 terms which provides negligible modeling error up to 20kHz. Example routines that can generate directional frequency and impulse array responses based on the above formula can be found [here](https://github.com/polarch/Array-Response-Simulator).


# Dataset specifications

General:

Recordings are taken in two different sites.

- Each recording clip is part of a recording session happening in a unique room.
- Groups of participants, sound making props, and scene scenarios are unique for each session (with a few exceptions).
- To achieve good variability and efficiency in the data, in terms of presence, density, movement, and/or spatial distribution of the sounds events, the scenes are loosely scripted.
- 13 target classes are identified in the recordings and strongly annotated by humans.
- Spatial annotations for those active events are captured by an optical tracking system.
- Sound events out of the target classes are considered as interference.
- Occurrences of up to 3 simultaneous events are fairly common, while higher numbers of overlapping events (up to 5) can occur but are rare.

Volume, duration, and data split:

- A total of 16 unique rooms captured in the recordings, 4 in Tokyo and 12 in Tampere (development set).
- 70 recording clips of 30 sec ~ 5 min durations, with a total time of ~2hrs, captured in Tokyo (development dataset).
- 98 recording clips of 40 sec ~ 9 min durations, with a total time of ~5.5hrs, captured in Tampere (development dataset).
- 79 recordings clips of 40 sec ~ 7 min durations, with a total time of ~3.5hrs, captured in both sites (evaluation dataset).
- A training-testing split is provided for reporting results using the development dataset.
- 40 recordings contributed by Sony for the training split, captured in 2 rooms (dev-train-sony).
- 30 recordings contributed by Sony for the testing split, captured in 2 rooms (dev-test-sony).
- 50 recordings contributed by TAU for the training split, captured in 7 rooms (dev-train-tau).
- 48 recordings contributed by TAU for the testing split, captured in 5 rooms (dev-test-tau).

Audio:

- Sampling rate: 24 kHz.
- Bit depth:     16 bits.
- Two 4-channel 3-dimensional recording formats: first-order Ambisonics (FOA) and tetrahedral microphone array (MIC).

Video:

- Video 360° format:                equirectangular
- Video resolution:                 1920x960
- Video frames per second (fps):    29.97
- All audio recordings are accompanied by synchronised video recordings, apart from 12 audio recordings with missing videos (fold3_room21_mix001.wav - fold3_room21_mix012.wav)

# Video data

The simultaneous 360° video are spatially and temporally aligned with the microphone array recordings. The videos are made available with the participants' consent, after blurring visible faces.

# Sound event classes

13 target sound event classes were annotated. The classes follow loosely the [Audioset ontology](https://research.google.com/audioset/ontology/index.html).

  0. Female speech, woman speaking
  1. Male speech, man speaking
  2. Clapping
  3. Telephone
  4. Laughter
  5. Domestic sounds
  6. Walk, footsteps
  7. Door, open or close
  8. Music
  9. Musical instrument
  10. Water tap, faucet
  11. Bell
  12. Knock

The content of some of these classes corresponds to events of a limited range of Audioset-related subclasses. These are detailed here as additional information on the diversity of those sound events:

  - Telephone
    - Mostly traditional _Telephone Bell Ringing_ and _Ringtone_ sounds, without musical ringtones.
  - Domestic sounds
    - Sounds of _Vacuum cleaner_
    - Sounds of water boiler, closer to _Boiling_
    - Sounds of air circulator, closer to _Mechanical fan_
  - Door, open or close
    - Combination of _Door_ and _Cupboard open or close_
  - Music
    - _Background music_ and _Pop music_ played by a loudspeaker in the room.
  - Musical Instrument
    - Acoustic guitar
    - Marimba, xylophone
    - Cowbell
    - Piano
    - Rattle (instrument)
  - Bell
    - Combination of sounds from hotel bell and glass bell, closer to _Bicycle bell_ and single _Chime_.

Some additional notes:
- The speech classes contain speech in a few different languages.
- There are occasionally localized sound events that are not annotated and are considered as interferers, with examples such as _computer keyboard_, _shuffling cards_, _dishes, pots, and pans_.
- There is natural background noise (e.g. HVAC noise) in all recordings, at very low levels in some and at quite high levels in others. Such mostly diffuse background noise should be distinct from other noisy target sources (e.g. vacuum cleaner, mechanical fan) since these are clearly spatially localized.


# Naming Convention (Development dataset)

The recordings in the development dataset follow the naming convention:

    fold[fold number]_room[room number]_mix[recording number per room].wav

The fold number at the moment is used only to distinguish between the training and testing split. The room information is provided for the user of the dataset to potentially help understand the performance of their method with respect to different conditions.

# Naming Convention (Evaluation dataset)

The recordings in the evaluation dataset have no additional information and follow the naming convention:

    mix[recording number].wav

# Reference labels and directions-of-arrival

For each recording in the development dataset, the labels and DoAs are provided in a plain text CSV file of the same filename as the recording, in the following format:

    [frame number (int)], [active class index (int)], [source number index (int)], [azimuth (int)], [elevation (int)], [distance (int)]

Frame, class, and source enumeration begins at 0. Frames correspond to a temporal resolution of 100msec. Azimuth and elevation angles are given in degrees, rounded to the closest integer value, with azimuth and elevation being zero at the front, azimuth $\phi \in [-180^{\circ}, 180^{\circ}]$, and elevation $\theta \in [-90^{\circ}, 90^{\circ}]$. Note that the azimuth angle is increasing counter-clockwise ($\phi = 90^{\circ}$ at the left). 

The source index is a unique integer for each source in the scene, and it is provided only as additional information. Note that each unique actor gets assigned one such identifier, but not individual events produced by the same actor; e.g. a _clapping_ event and a _laughter_ event produced by the same person have the same identifier. Independent sources that are not actors (e.g. a loudspeaker playing music in the room) get a 0 identifier. Note that source identifier information is only included in the development metadata and is not required to be provided by the participants in their results.

Overlapping sound events are indicated with duplicate frame numbers, and can belong to a different or the same class. An example sequence could be as:

    10,     1,  1,  -50,  30
    11,     1,  1,  -50,  30
    11,     1,  2,   10, -20
    12,     1,  2,   10, -20
    13,     1,  2,   10, -20
    13,     8,  0,  -40,   0

which describes that in frame 10-11, an event of class _male speech_ (_class 1_) belonging to one actor (_source 1_) is active at location (-50°,30°,180cm). However, at frame 11 a second instance of the same class appears simultaneously at a different direction (10°,-20°,243cm) belonging to another actor (_source 2_), while at frame 13 an additional event of class _music_ (_class 8_) appears belonging to a non-actor source (_source 0_). Frames that contain no sound events are not included in the sequence.


# Task setup

The dataset is associated with the [DCASE 2023 Challenge](http://dcase.community/challenge2023/). To have consistent reporting of results between participants on the development set a pre-defined training-testing split is provided. To compare against the challenge baseline and with other participants during the development stage, models should be trained on the training split only, and results should be reported on the testing split only.

**Note that even though there are two origins of the data, SONY and TAU, the challenge task considers the dataset as a single entity. Hence models should not be trained separately for each of the two origins, and tested individually on recordings of each of them. Instead, the recordings of the individual training splits (_dev-test-sony_, _dev_test_tau_) and testing splits (_dev-test-sony_, _dev_test_tau_) should be combined (_dev_train_, _dev_test_) and the models should be trained and evaluated in the respective combined splits.**

**Note that the source index and the source distance are only included in the development metadata as additional information that can be exploited during training. They are not required to be estimated or provided by the participants in their results.**

The evaluation part of the dataset is released as a new version, a few weeks before the final challenge submission deadline. The additional evaluation files consist of only audio/video recordings without any metadata/labels. Participants can decide the training procedure, i.e. the amount of training and validation files in the development dataset, the number of ensemble models etc., and submit the results of the SELD performance on the evaluation dataset.


# File structure

```
dataset root
│   README.md				this file, markdown-format
|   LICENSE                 the license file
│
└───foa_dev				Ambisonic format, 24kHz, four channels
|   |   dev-train-sony  to be used for training when reporting development set results (SONY recordings)
│   │  	|   fold3_room21_mix001.wav
│   │	|   fold3_room21_mix002.wav
│   │	|   ...
│   │	|   fold3_room22_mix001.wav
│   │	|   fold3_room22_mix002.wav
│   |   │	...
|   |   dev-test-sony   to be used for testing when reporting development set results (SONY recordings)
│   │   |   fold4_room23_mix001.wav
│   │   |   fold4_room23_mix002.wav
│   │   |   ...
│   │   |   fold4_room24_mix001.wav
│   │   |   fold4_room24_mix002.wav
│   │   |   ...
|   |   dev-train-tau   to be used for training when reporting development set results (TAU recordings)
│   │   |   fold3_room4_mix001.wav
│   │   |   fold3_room4_mix002.wav
│   │   |   ...
│   │   |   fold3_room6_mix001.wav
│   │   |   fold3_room6_mix002.wav
│   |   │    ...
│   │   |   fold3_room7_mix001.wav
│   │   |   fold3_room7_mix002.wav
│   |   │    ...
│   │   |   fold3_room9_mix001.wav
│   │   |   fold3_room9_mix002.wav
│   |   │    ...
|   |   dev-test-tau    to be used for testing when reporting development set results (TAU recordings)
│   │   |   fold4_room2_mix001.wav
│   │   |   fold4_room2_mix002.wav
│   │   |   ...
│   │   |   fold4_room8_mix001.wav
│   │   |   fold4_room8_mix002.wav
│   │   |   ...
│   │   |   fold4_room10_mix001.wav
│   │   |   fold4_room10_mix002.wav
│   │   |   ...
│
└───mic_dev				Microphone array format, 24kHz, four channels
|   |   dev-train-sony  to be used for training when reporting development set results (SONY recordings)
│   │   |   fold3_room21_mix001.wav
│   │   |   fold3_room21_mix002.wav
│   │   |   ...
│   │   |   fold3_room22_mix001.wav
│   │   |   fold3_room22_mix002.wav
│   |   │    ...
|   |   dev-test-sony   to be used for testing when reporting development set results (SONY recordings)
│   │   |   fold4_room23_mix001.wav
│   │   |   fold4_room23_mix002.wav
│   │   |   ...
│   │   |   fold4_room24_mix001.wav
│   │   |   fold4_room24_mix002.wav
│   │   |   ...
|   |   dev-train-tau   to be used for training when reporting development set results (TAU recordings)
│   │   |   fold3_room4_mix001.wav
│   │   |   fold3_room4_mix002.wav
│   │   |   ...
│   │   |   fold3_room6_mix001.wav
│   │   |   fold3_room6_mix002.wav
│   |   │    ...
│   │   |   fold3_room7_mix001.wav
│   │   |   fold3_room7_mix002.wav
│   |   │    ...
│   │   |   fold3_room9_mix001.wav
│   │   |   fold3_room9_mix002.wav
│   |   │    ...
|   |   dev-test-tau    to be used for testing when reporting development set results (TAU recordings)
│   │   |   fold4_room2_mix001.wav
│   │   |   fold4_room2_mix002.wav
│   │   |   ...
│   │   |   fold4_room8_mix001.wav
│   │   |   fold4_room8_mix002.wav
│   │   |   ...
│   │   |   fold4_room10_mix001.wav
│   │   |   fold4_room10_mix002.wav
│   │   |   ...
│
└───video_dev       Video files, 22.97fps, 1920x960 pixels
|   |   dev-train-sony  to be used for training when reporting development set results (SONY recordings)
│   │   |   fold3_room21_mix013.wav
│   │   |   fold3_room21_mix014.wav
│   │   |   ...
│   │   |   fold3_room22_mix001.wav
│   │   |   fold3_room22_mix002.wav
│   |   │    ...
|   |   dev-test-sony   to be used for testing when reporting development set results (SONY recordings)
│   │   |   fold4_room23_mix001.wav
│   │   |   fold4_room23_mix002.wav
│   │   |   ...
│   │   |   fold4_room24_mix001.wav
│   │   |   fold4_room24_mix002.wav
│   │   |   ...
|   |   dev-train-tau   to be used for training when reporting development set results (TAU recordings)
│   │   |   fold3_room4_mix001.wav
│   │   |   fold3_room4_mix002.wav
│   │   |   ...
│   │   |   fold3_room6_mix001.wav
│   │   |   fold3_room6_mix002.wav
│   |   │    ...
│   │   |   fold3_room7_mix001.wav
│   │   |   fold3_room7_mix002.wav
│   |   │    ...
│   │   |   fold3_room9_mix001.wav
│   │   |   fold3_room9_mix002.wav
│   |   │    ...
|   |   dev-test-tau    to be used for testing when reporting development set results (TAU recordings)
│   │   |   fold4_room2_mix001.wav
│   │   |   fold4_room2_mix002.wav
│   │   |   ...
│   │   |   fold4_room8_mix001.wav
│   │   |   fold4_room8_mix002.wav
│   │   |   ...
│   │   |   fold4_room10_mix001.wav
│   │   |   fold4_room10_mix002.wav
│   │   |   ...
|
└───metadata_dev		`csv` format, 600 files
|   |   dev-train-sony  to be used for training when reporting development set results (SONY recordings)
│   │   |   fold3_room21_mix001.csv
│   │   |   fold3_room21_mix002.csv
│   │   |   ...
│   │   |   fold3_room22_mix001.csv
│   │   |   fold3_room22_mix002.csv
│   |   │    ...
|   |   dev-test-sony   to be used for testing when reporting development set results (SONY recordings)
│   │   |   fold4_room23_mix001.csv
│   │   |   fold4_room23_mix002.csv
│   │   |   ...
│   │   |   fold4_room24_mix001.csv
│   │   |   fold4_room24_mix002.csv
│   │   |   ...
|   |   dev-train-tau   to be used for training when reporting development set results (TAU recordings)
│   │   |   fold3_room4_mix001.csv
│   │   |   fold3_room4_mix002.csv
│   │   |   ...
│   │   |   fold3_room6_mix001.csv
│   │   |   fold3_room6_mix002.csv
│   |   │    ...
│   │   |   fold3_room7_mix001.csv
│   │   |   fold3_room7_mix002.csv
│   |   │    ...
│   │   |   fold3_room9_mix001.csv
│   │   |   fold3_room9_mix002.csv
│   |   │    ...
|   |   dev-test-tau    to be used for testing when reporting development set results (TAU recordings)
│   │   |   fold4_room2_mix001.csv
│   │   |   fold4_room2_mix002.csv
│   │   |   ...
│   │   |   fold4_room8_mix001.csv
│   │   |   fold4_room8_mix002.csv
│   │   |   ...
│   │   |   fold4_room10_mix001.csv
│   │   |   fold4_room10_mix002.csv
│   │   |   ...
|
└───foa_eval        Ambisonic format, 24kHz, four channels
|   |   mix001.wav
|   |   ...
|   |   mix079.wav
|
└───mic_eval        Microphone array format, 24kHz, four channels
|   |   mix001.wav
|   |   ...
|   |   mix079.wav
|
└───video_eval      Video files, 22.97fps, 1920x960 pixels
|   |   mix001.wav
|   |   ...
|   |   mix079.wav

```
# Download

The file `foa_dev.zip`, corresponds to audio data of the **FOA** recording format for the development dataset.
The file `mic_dev.zip`, corresponds to audio data of the **MIC** recording format for the development dataset.

The file `video_dev.zip` contains the common videos for both audio formats of the development dataset.
The file `metadata_dev.zip` contains the common metadata for both audio formats of the development dataset.

The file `foa_eval.zip` corresponds to audio data of the **FOA** recording format for the evaluation dataset (released before the evaluation phase of the challenge).
The file `mic_eval.zip` corresponds to audio data of the **MIC** recording format for the evaluation dataset (to be released before the evaluation phase of the challenge).
The file `video_eval.zip` contains the common videos for both audio formats of the evaluation dataset (to be released after the end of the challenge). 

Download the zip files corresponding to the format of interest and use your favorite compression tool to unzip these zip files.

# Example application

An implementation of a trainable model performing **audio-only** joint SELD, trained and evaluated with this dataset is provided [here](https://github.com/sharathadavanne/seld-dcase2023). This implementation will serve as the baseline method in the DCASE 2023 Sound Event Localization and Detection Task, under the audio-only inference track.

Additionally, an implementation of a trainable model performing **audiovisual** SELD, trained and evaluated with this dataset is provided [here](https://github.com/sony/audio-visual-seld-dcase2023). This implementation will serve as the baseline method in the DCASE 2023 Sound Event Localization and Detection Task, under the audiovisual inference track.


# License

This datast is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
