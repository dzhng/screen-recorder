# Blind waveform skill use

A fresh gpt-6-luna agent received only the product skill, a frozen CLI launcher,
source/project IDs and a read-only inspection task. It located the short dominant
energy interval with 2 ms detail, mapped both project occurrences, and measured
the first occurrence's dry/processed track peak and RMS per channel. The known
fixture is retained as reference.wav; no model, playback or capture was used.

The agent found source samples 38,400–39,360 at 48 kHz (800–820 ms), occurring at
800–820 ms and 2,800–2,820 ms in the project. Dry track peak/RMS was 1.5/1.5 left
and 1/1 right; processed values were 0.75/0.75 and 0.5/0.5. It correctly explained
that a dry track still includes the clip's gain. It explicitly declined to claim
listening verification.

The grade checks delivered JSON values, the unchanged project head and all logged
commands. Source and project clocks remain absolute in the ranged artifacts.
The fixture service stopped successfully and its scratch home was removed.
This proves this bounded numerical inspection workflow, not speech interpretation,
image usability, spectrogram navigation or perceptual quality.
